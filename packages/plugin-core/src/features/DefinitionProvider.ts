import { ConfigUtils, NoteUtils, VaultUtils } from "@dendronhq/common-all";
import _ from "lodash";
import vscode, { Location, Position, Uri } from "vscode";
import { findAnchorPos, GotoNoteCommand } from "../commands/GotoNote";
import { Logger } from "../logger";
import { getReferenceAtPosition } from "../utils/md";
import { DendronExtension, getDWorkspace } from "../workspace";
import * as Sentry from "@sentry/node";

export default class DefinitionProvider implements vscode.DefinitionProvider {
  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Location | vscode.Location[] | undefined> {
    try {
      // No-op if we're not in a Dendron Workspace
      if (!DendronExtension.isActive()) {
        return;
      }
      const refAtPos = getReferenceAtPosition(document, position);
      if (!refAtPos) {
        return;
      }
      let vault;
      const { engine } = getDWorkspace();
      if (refAtPos.vaultName) {
        try {
          vault = VaultUtils.getVaultByName({
            vaults: engine.vaults,
            vname: refAtPos.vaultName,
          });
        } catch (err) {
          Logger.error({ msg: `${refAtPos.vaultName} is not defined` });
        }
      }
      const notes = NoteUtils.getNotesByFname({
        fname: refAtPos.ref,
        notes: engine.notes,
        vault,
      });
      const uris = notes.map((note) =>
        Uri.file(
          NoteUtils.getFullPath({ note, wsRoot: getDWorkspace().wsRoot })
        )
      );
      const out = uris.map((uri) => new Location(uri, new Position(0, 0)));
      if (out.length > 1) {
        return out;
      } else if (out.length === 1) {
        const loc = out[0];
        if (refAtPos.anchorStart) {
          const pos = findAnchorPos({
            anchor: refAtPos.anchorStart,
            note: notes[0],
          });
          return new Location(loc.uri, pos);
        }
        return loc;
      } else {
        const config = getDWorkspace().config;

        const noAutoCreateOnDefinition =
          !ConfigUtils.getWorkspace(config).enableAutoCreateOnDefinition;
        if (noAutoCreateOnDefinition) {
          return;
        }
        const out = await new GotoNoteCommand().execute({
          qs: refAtPos.ref,
          anchor: refAtPos.anchorStart,
        });
        if (_.isUndefined(out)) {
          return;
        }
        const { note, pos } = out;
        return new Location(
          Uri.file(
            NoteUtils.getFullPath({ note, wsRoot: getDWorkspace().wsRoot })
          ),
          pos || new Position(0, 0)
        );
      }
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }
}
