import { ConfigUtils, NoteProps } from "@dendronhq/common-all";
import { NoteTestUtilsV4 } from "@dendronhq/common-test-utils";
import { VSCodeUtils } from "../../utils";
import { LocationTestUtils, runSingleVaultTest, expect } from "../testUtilsv2";
import { runLegacySingleWorkspaceTest, setupBeforeAfter } from "../testUtilsV3";
import * as vscode from "vscode";
import { describe } from "mocha";
import { getHeaderAt, isBrokenWikilink } from "../../utils/editor";

suite("Contextual UI Tests", function () {
  const ctx = setupBeforeAfter(this, {});
  describe("GIVEN only broken wikilink is selected in editor", () => {
    test("THEN code action for create new note is displayed", (done) => {
      let noteWithLink: NoteProps;
      runSingleVaultTest({
        ctx,
        preSetupHook: async ({ wsRoot, vaults }) => {
          noteWithLink = await NoteTestUtilsV4.createNote({
            fname: "test",
            vault: vaults[0],
            wsRoot,
            body: "[[foo.bar]]",
          });
        },
        onInit: async () => {
          const editor = await VSCodeUtils.openNote(noteWithLink);
          const start = LocationTestUtils.getPresetWikiLinkPosition();
          const end = LocationTestUtils.getPresetWikiLinkPosition({ char: 10 });
          editor.selection = new vscode.Selection(start, end);
          expect(isBrokenWikilink()).toBeTruthy();
          done();
        },
      });
    });

    describe("AND selected link is a broken user tag", () => {
      test("THEN code action for create new note is displayed", (done) => {
        let noteWithLink: NoteProps;
        runLegacySingleWorkspaceTest({
          ctx,
          postSetupHook: async ({ wsRoot, vaults }) => {
            noteWithLink = await NoteTestUtilsV4.createNote({
              fname: "test",
              vault: vaults[0],
              wsRoot,
              body: "@foo.bar",
            });
          },
          onInit: async () => {
            const editor = await VSCodeUtils.openNote(noteWithLink);
            editor.selection = LocationTestUtils.getPresetWikiLinkSelection();
            expect(isBrokenWikilink()).toBeTruthy();
            done();
          },
        });
      });

      describe("AND user tags are disabled", () => {
        test("THEN code action for create new note is NOT displayed", (done) => {
          let noteWithLink: NoteProps;
          runLegacySingleWorkspaceTest({
            ctx,
            postSetupHook: async ({ wsRoot, vaults }) => {
              noteWithLink = await NoteTestUtilsV4.createNote({
                fname: "test",
                vault: vaults[0],
                wsRoot,
                body: "@foo.bar",
              });
            },
            modConfigCb: (config) => {
              ConfigUtils.setWorkspaceProp(config, "enableUserTags", false);
              return config;
            },
            onInit: async () => {
              const editor = await VSCodeUtils.openNote(noteWithLink);
              editor.selection = LocationTestUtils.getPresetWikiLinkSelection();
              expect(isBrokenWikilink()).toBeFalsy();
              done();
            },
          });
        });
      });
    });
  });

  describe("GIVEN header is selected in editor", () => {
    test("THEN code action for rename header is displayed", (done) => {
      let noteWithLink: NoteProps;
      runSingleVaultTest({
        ctx,
        preSetupHook: async ({ wsRoot, vaults }) => {
          noteWithLink = await NoteTestUtilsV4.createNote({
            fname: "test",
            vault: vaults[0],
            wsRoot,
            body: "## Welcome",
          });
        },
        onInit: async () => {
          const editor = await VSCodeUtils.openNote(noteWithLink);
          const start = new vscode.Position(7, 2);
          const end = new vscode.Position(7, 10);
          editor.selection = new vscode.Selection(start, end);
          expect(isBrokenWikilink()).toBeFalsy();
          expect(getHeaderAt({ editor, position: start })).toNotEqual(
            undefined
          );
          done();
        },
      });
    });
  });

  describe("GIVEN some text is selected in editor", () => {
    test("THEN code action for create note is displayed", (done) => {
      let noteWithLink: NoteProps;
      runSingleVaultTest({
        ctx,
        preSetupHook: async ({ wsRoot, vaults }) => {
          noteWithLink = await NoteTestUtilsV4.createNote({
            fname: "test",
            vault: vaults[0],
            wsRoot,
            body: "This is a root page",
          });
        },
        onInit: async () => {
          const editor = await VSCodeUtils.openNote(noteWithLink);
          const start = new vscode.Position(7, 0);
          const end = new vscode.Position(7, 18);
          editor.selection = new vscode.Selection(start, end);
          expect(getHeaderAt({ editor, position: start })).toEqual(undefined);
          expect(isBrokenWikilink()).toBeFalsy();
          done();
        },
      });
    });
  });
});
