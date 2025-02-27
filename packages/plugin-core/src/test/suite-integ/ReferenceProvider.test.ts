import { NoteProps, NoteUtils, VaultUtils } from "@dendronhq/common-all";
import {
  AssertUtils,
  NoteTestUtilsV4,
  NOTE_PRESETS_V4,
} from "@dendronhq/common-test-utils";
import { ENGINE_HOOKS_MULTI } from "@dendronhq/engine-test-utils";
import fs from "fs-extra";
import { describe } from "mocha";
import path from "path";
import * as vscode from "vscode";
import ReferenceHoverProvider from "../../features/ReferenceHoverProvider";
import ReferenceProvider from "../../features/ReferenceProvider";
import { VSCodeUtils } from "../../utils";
import { getDWorkspace } from "../../workspace";
import { expect, LocationTestUtils } from "../testUtilsv2";
import { runLegacyMultiWorkspaceTest, setupBeforeAfter } from "../testUtilsV3";

async function provide(editor: vscode.TextEditor) {
  const doc = editor?.document as vscode.TextDocument;
  const referenceProvider = new ReferenceProvider();
  const links = await referenceProvider.provideReferences(
    doc,
    new vscode.Position(7, 2)
  );
  return links;
}

suite("ReferenceProvider", function () {
  const ctx = setupBeforeAfter(this, {
    beforeHook: () => {},
  });

  describe("provides correct links", () => {
    test("basic", (done) => {
      let noteWithTarget1: NoteProps;
      let noteWithTarget2: NoteProps;
      runLegacyMultiWorkspaceTest({
        ctx,
        preSetupHook: async ({ wsRoot, vaults }) => {
          noteWithTarget1 = await NOTE_PRESETS_V4.NOTE_WITH_TARGET.create({
            fname: "alpha",
            vault: vaults[0],
            wsRoot,
          });
          noteWithTarget2 = await NOTE_PRESETS_V4.NOTE_WITH_TARGET.create({
            fname: "beta",
            vault: vaults[0],
            wsRoot,
          });
        },
        onInit: async () => {
          const editor = await VSCodeUtils.openNote(noteWithTarget1);
          const links = await provide(editor);
          expect(links!.map((l) => l.uri.fsPath)).toEqual(
            [noteWithTarget1, noteWithTarget2].map((note) =>
              NoteUtils.getFullPath({ note, wsRoot: getDWorkspace().wsRoot })
            )
          );
          done();
        },
      });
    });

    test("with multiple vaults", (done) => {
      let noteWithTarget1: NoteProps;
      let noteWithTarget2: NoteProps;
      runLegacyMultiWorkspaceTest({
        ctx,
        preSetupHook: async ({ wsRoot, vaults }) => {
          noteWithTarget1 = await NOTE_PRESETS_V4.NOTE_WITH_TARGET.create({
            fname: "alpha",
            vault: vaults[0],
            wsRoot,
          });
          noteWithTarget2 = await NOTE_PRESETS_V4.NOTE_WITH_TARGET.create({
            fname: "beta",
            vault: vaults[1],
            wsRoot,
          });
        },
        onInit: async () => {
          const editor = await VSCodeUtils.openNote(noteWithTarget1);
          const links = await provide(editor);
          expect(links!.map((l) => l.uri.fsPath)).toEqual(
            [noteWithTarget1, noteWithTarget2].map((note) =>
              NoteUtils.getFullPath({ note, wsRoot: getDWorkspace().wsRoot })
            )
          );
          done();
        },
      });
    });

    test("with anchor", (done) => {
      let noteWithLink: NoteProps;

      runLegacyMultiWorkspaceTest({
        ctx,
        preSetupHook: async ({ wsRoot, vaults }) => {
          await NOTE_PRESETS_V4.NOTE_WITH_ANCHOR_TARGET.create({
            vault: vaults[0],
            wsRoot,
          });
          noteWithLink = await NOTE_PRESETS_V4.NOTE_WITH_ANCHOR_LINK.create({
            vault: vaults[0],
            wsRoot,
          });
        },
        onInit: async () => {
          const editor = await VSCodeUtils.openNote(noteWithLink);
          const links = await provide(editor);
          expect(links!.map((l) => l.uri.fsPath)).toEqual(
            [noteWithLink].map((note) =>
              NoteUtils.getFullPath({ note, wsRoot: getDWorkspace().wsRoot })
            )
          );
          done();
        },
      });
    });

    test("with alias", (done) => {
      let noteWithLink: NoteProps;

      runLegacyMultiWorkspaceTest({
        ctx,
        preSetupHook: async ({ wsRoot, vaults }) => {
          await NOTE_PRESETS_V4.NOTE_WITH_TARGET.create({
            vault: vaults[0],
            wsRoot,
          });
          noteWithLink = await NOTE_PRESETS_V4.NOTE_WITH_ALIAS_LINK.create({
            vault: vaults[0],

            wsRoot,
          });
        },
        onInit: async () => {
          const editor = await VSCodeUtils.openNote(noteWithLink);
          const links = await provide(editor);
          expect(links!.map((l) => l.uri.fsPath)).toEqual(
            [noteWithLink].map((note) =>
              NoteUtils.getFullPath({ note, wsRoot: getDWorkspace().wsRoot })
            )
          );
          done();
        },
      });
    });
  });

  describe("has correct hover contents", () => {
    describe("wikilink", () => {
      test("basic", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: "[[target]]",
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ],
            });
            done();
          },
        });
      });

      test("missing notes are marked as such", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: "[[target]]", // target doesn't exist
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                `Note target is missing`,
                `use "Dendron: Goto Note" command`,
              ],
            });
            done();
          },
        });
      });

      test.skip("contains local image", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: [
                "Sint quo sunt maxime.",
                "![](/assets/test/image.png)",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: "[[target]]",
            });
          },
          onInit: async ({ wsRoot, vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            // Local images should get full path to image, because hover preview otherwise can't find the image
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                `![](${path.join(
                  wsRoot,
                  VaultUtils.getRelPath(vaults[0]),
                  "assets/test/image.png"
                )})`,
              ],
            });
            done();
          },
        });
      });

      test("contains remote image", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: [
                "Sint quo sunt maxime.",
                "![](https://example.com/image.png)",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: "[[target]]",
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            // remote images should be unmodified
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                "![](https://example.com/image.png)",
              ],
            });
            done();
          },
        });
      });

      test("with alias", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: "[[my note alias|target]]",
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ],
            });
            done();
          },
        });
      });

      test("with xvault", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            // Creating a note of the same name in multiple vaults to check that it gets the right one
            await NoteTestUtilsV4.createNote({
              vault: vaults[1],
              wsRoot,
              fname: "target",
              body: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: "Voluptatem possimus harum nisi.",
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: `[[dendron://${VaultUtils.getName(vaults[1])}/target]]`,
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ],
              nomatch: ["Voluptatem possimus harum nisi."],
            });
            done();
          },
        });
      });

      test("with header", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: [
                "Voluptatem possimus harum nisi.",
                "",
                "# Numquam occaecati",
                "",
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: `[[target#numquam-occaecati]]`,
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 12)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ],
              nomatch: ["Voluptatem possimus harum nisi."],
            });
            done();
          },
        });
      });

      test("with block anchor", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: [
                "Voluptatem possimus harum nisi.",
                "",
                "# Numquam occaecati",
                "",
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima. ^my-anchor",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: `[[target#^my-anchor]]`,
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ],
              nomatch: ["Voluptatem possimus harum nisi.", "Numquam occaecati"],
            });
            done();
          },
        });
      });

      test("with everything", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[1],
              wsRoot,
              fname: "target",
              body: [
                "Voluptatem possimus harum nisi.",
                "",
                "# Numquam occaecati",
                "",
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: "Voluptatem possimus harum nisi.",
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: `[[My note: with an alias|dendron://${VaultUtils.getName(
                vaults[1]
              )}/target#numquam-occaecati]]`,
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ],
              nomatch: ["Voluptatem possimus harum nisi."],
            });
            done();
          },
        });
      });

      describe("multiple notes & xvault link", () => {
        test("non-xvault link resolves to same vault", (done) => {
          let note: NoteProps;
          runLegacyMultiWorkspaceTest({
            ctx,
            preSetupHook: async (opts) => {
              note = await ENGINE_HOOKS_MULTI.setupMultiVaultSameFname(opts);
            },
            onInit: async () => {
              const editor = await VSCodeUtils.openNote(note);
              editor.selection = LocationTestUtils.getPresetWikiLinkSelection({
                line: 7,
              });
              const provider = new ReferenceHoverProvider();
              const hover = await provider.provideHover(
                editor.document,
                new vscode.Position(7, 4)
              );
              expect(hover).toBeTruthy();
              expect(
                await AssertUtils.assertInString({
                  body: hover!.contents.join(""),
                  match: ["vault 1"],
                  nomatch: ["vault 0", "the test note"],
                })
              ).toBeTruthy();
              done();
            },
          });
        });

        test("xvault link to other vault", (done) => {
          let note: NoteProps;
          runLegacyMultiWorkspaceTest({
            ctx,
            preSetupHook: async (opts) => {
              note = await ENGINE_HOOKS_MULTI.setupMultiVaultSameFname(opts);
            },
            onInit: async () => {
              const editor = await VSCodeUtils.openNote(note);
              const provider = new ReferenceHoverProvider();
              const hover = await provider.provideHover(
                editor.document,
                new vscode.Position(8, 4)
              );
              expect(hover).toBeTruthy();
              expect(
                await AssertUtils.assertInString({
                  body: hover!.contents.join(""),
                  match: ["vault 0"],
                  nomatch: ["vault 1", "the test note"],
                })
              ).toBeTruthy();
              done();
            },
          });
        });

        test("xvault link to same vault", (done) => {
          let note: NoteProps;
          runLegacyMultiWorkspaceTest({
            ctx,
            preSetupHook: async (opts) => {
              note = await ENGINE_HOOKS_MULTI.setupMultiVaultSameFname(opts);
            },
            onInit: async () => {
              const editor = await VSCodeUtils.openNote(note);
              const provider = new ReferenceHoverProvider();
              const hover = await provider.provideHover(
                editor.document,
                new vscode.Position(9, 4)
              );
              expect(hover).toBeTruthy();
              expect(
                await AssertUtils.assertInString({
                  body: hover!.contents.join(""),
                  match: ["vault 1"],
                  nomatch: ["vault 0", "the test note"],
                })
              ).toBeTruthy();
              done();
            },
          });
        });

        test("xvault link to non-existant note", (done) => {
          let note: NoteProps;
          runLegacyMultiWorkspaceTest({
            ctx,
            preSetupHook: async (opts) => {
              note = await ENGINE_HOOKS_MULTI.setupMultiVaultSameFname(opts);
            },
            onInit: async () => {
              const editor = await VSCodeUtils.openNote(note);
              const provider = new ReferenceHoverProvider();
              const hover = await provider.provideHover(
                editor.document,
                new vscode.Position(10, 4)
              );
              expect(hover).toBeTruthy();
              expect(
                await AssertUtils.assertInString({
                  body: hover!.contents.join(""),
                  match: ["eggs", "vaultThree", "missing"],
                  nomatch: [
                    "vault 0",
                    "vault 1",
                    "vault1",
                    "vault2",
                    "the test note",
                  ],
                })
              ).toBeTruthy();
              done();
            },
          });
        });

        test("xvault link to non-existant vault", (done) => {
          let note: NoteProps;
          runLegacyMultiWorkspaceTest({
            ctx,
            preSetupHook: async (opts) => {
              note = await ENGINE_HOOKS_MULTI.setupMultiVaultSameFname(opts);
            },
            onInit: async () => {
              const editor = await VSCodeUtils.openNote(note);
              const provider = new ReferenceHoverProvider();
              const hover = await provider.provideHover(
                editor.document,
                new vscode.Position(11, 4)
              );
              expect(hover).toBeTruthy();
              expect(
                await AssertUtils.assertInString({
                  body: hover!.contents.join(""),
                  match: ["vault3", "does not exist"],
                  nomatch: [
                    "vault 0",
                    "vault 1",
                    "vault1",
                    "vault2",
                    "the test note",
                  ],
                })
              ).toBeTruthy();
              done();
            },
          });
        });
      });
    });

    describe("reference", () => {
      test("basic", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: "![[target]]",
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ],
            });
            done();
          },
        });
      });

      test("with xvault", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            // Creating a note of the same name in multiple vaults to check that it gets the right one
            await NoteTestUtilsV4.createNote({
              vault: vaults[1],
              wsRoot,
              fname: "target",
              body: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: "Voluptatem possimus harum nisi.",
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: `![[dendron://${VaultUtils.getName(vaults[1])}/target]]`,
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ],
              nomatch: ["Voluptatem possimus harum nisi."],
            });
            done();
          },
        });
      });

      test("with header", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: [
                "Voluptatem possimus harum nisi.",
                "",
                "# Numquam occaecati",
                "",
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: `![[target#numquam-occaecati]]`,
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ],
              nomatch: ["Voluptatem possimus harum nisi."],
            });
            done();
          },
        });
      });

      test("with block anchor", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: [
                "Voluptatem possimus harum nisi.",
                "",
                "# Numquam occaecati",
                "",
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima. ^my-anchor",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: `![[target#^my-anchor]]`,
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ],
              nomatch: ["Voluptatem possimus harum nisi.", "Numquam occaecati"],
            });
            done();
          },
        });
      });

      test("with range", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "target",
              body: [
                "Voluptatem possimus harum nisi.",
                "",
                "# Numquam occaecati",
                "",
                "Sint quo sunt maxime.",
                "",
                "Nisi nam dolorem qui ut minima. ^my-anchor",
                "",
                "Ut quo eius laudantium.",
              ].join("\n"),
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: `![[target#numquam-occaecati:#^my-anchor]]`,
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: [
                "Numquam occaecati",
                "Sint quo sunt maxime.",
                "Nisi nam dolorem qui ut minima.",
              ],
              nomatch: [
                "Voluptatem possimus harum nisi.",
                "Ut quo eius laudantium.",
              ],
            });
            done();
          },
        });
      });
    });

    test("hashtag", (done) => {
      runLegacyMultiWorkspaceTest({
        ctx,
        preSetupHook: async ({ wsRoot, vaults }) => {
          await NoteTestUtilsV4.createNote({
            vault: vaults[0],
            wsRoot,
            fname: "tags.foo.test",
            body: "this is tag foo.test",
          });
          await NoteTestUtilsV4.createNote({
            vault: vaults[0],
            wsRoot,
            fname: "source",
            body: "#foo.test",
          });
        },
        onInit: async ({ vaults }) => {
          const editor = await VSCodeUtils.openNoteByPath({
            vault: vaults[0],
            fname: "source",
          });
          const provider = new ReferenceHoverProvider();
          const hover = await provider.provideHover(
            editor.document,
            new vscode.Position(7, 6)
          );
          expect(hover).toBeTruthy();
          await AssertUtils.assertInString({
            body: hover!.contents.join(""),
            match: ["this is tag foo.test"],
          });
          done();
        },
      });
    });

    test("hashtags are ignored when disabled", (done) => {
      runLegacyMultiWorkspaceTest({
        ctx,
        preSetupHook: async ({ wsRoot, vaults }) => {
          await NoteTestUtilsV4.createNote({
            vault: vaults[0],
            wsRoot,
            fname: "tags.foo.test",
            body: "this is tag foo.test",
          });
          await NoteTestUtilsV4.createNote({
            vault: vaults[0],
            wsRoot,
            fname: "source",
            body: "#foo.test",
          });
        },
        modConfigCb: (config) => {
          config.workspace!.enableHashTags = false;
          return config;
        },
        onInit: async ({ vaults }) => {
          const editor = await VSCodeUtils.openNoteByPath({
            vault: vaults[0],
            fname: "source",
          });
          const provider = new ReferenceHoverProvider();
          const hover = await provider.provideHover(
            editor.document,
            new vscode.Position(7, 6)
          );
          expect(hover).toBeFalsy();
          done();
        },
      });
    });

    test("user tag", (done) => {
      runLegacyMultiWorkspaceTest({
        ctx,
        preSetupHook: async ({ wsRoot, vaults }) => {
          await NoteTestUtilsV4.createNote({
            vault: vaults[0],
            wsRoot,
            fname: "user.test.mctestface",
            body: "this is user test.mctestface",
          });
          await NoteTestUtilsV4.createNote({
            vault: vaults[0],
            wsRoot,
            fname: "source",
            body: "@test.mctestface",
          });
        },
        onInit: async ({ vaults }) => {
          const editor = await VSCodeUtils.openNoteByPath({
            vault: vaults[0],
            fname: "source",
          });
          const provider = new ReferenceHoverProvider();
          const hover = await provider.provideHover(
            editor.document,
            new vscode.Position(7, 6)
          );
          expect(hover).toBeTruthy();
          await AssertUtils.assertInString({
            body: hover!.contents.join(""),
            match: ["this is user test.mctestface"],
          });
          done();
        },
      });
    });

    test("user tags are ignored when disabled", (done) => {
      runLegacyMultiWorkspaceTest({
        ctx,
        preSetupHook: async ({ wsRoot, vaults }) => {
          await NoteTestUtilsV4.createNote({
            vault: vaults[0],
            wsRoot,
            fname: "user.test.mctestface",
            body: "this is user test.mctestface",
          });
          await NoteTestUtilsV4.createNote({
            vault: vaults[0],
            wsRoot,
            fname: "source",
            body: "@test.mctestface",
          });
        },
        modConfigCb: (config) => {
          config.workspace!.enableUserTags = false;
          return config;
        },
        onInit: async ({ vaults }) => {
          const editor = await VSCodeUtils.openNoteByPath({
            vault: vaults[0],
            fname: "source",
          });
          const provider = new ReferenceHoverProvider();
          const hover = await provider.provideHover(
            editor.document,
            new vscode.Position(7, 6)
          );
          expect(hover).toBeFalsy();
          done();
        },
      });
    });

    describe("frontmatter tags", () => {
      test("single tag", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "tags.foo.test",
              body: "this is tag foo.test",
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              props: {
                tags: "foo.test",
              },
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(6, 10)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: ["this is tag foo.test"],
            });
            done();
          },
        });
      });

      test("multiple tags", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "tags.foo.test",
              body: "this is tag foo.test",
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "tags.foo.bar",
              body: "this is the wrong tag",
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "tags.foo.baz",
              body: "this is the wrong tag",
            });
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              props: {
                tags: ["foo.bar", "foo.test", "foo.baz"],
              },
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(8, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: ["this is tag foo.test"],
            });
            done();
          },
        });
      });
    });

    describe("non-note", () => {
      test("image", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await fs.ensureFile(
              path.join(
                wsRoot,
                VaultUtils.getName(vaults[0]),
                "assets",
                "image.png"
              )
            );
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: "![[/assets/image.png]]",
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: ["[", "]", "(", "/assets/image.png", ")"],
            });
            done();
          },
        });
      });

      test("hyperlink", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: "![[http://example.com]]",
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: ["[", "]", "(", "http://example.com", ")"],
            });
            done();
          },
        });
      });

      test("email", (done) => {
        runLegacyMultiWorkspaceTest({
          ctx,
          preSetupHook: async ({ wsRoot, vaults }) => {
            await NoteTestUtilsV4.createNote({
              vault: vaults[0],
              wsRoot,
              fname: "source",
              body: "![[mailto:user@example.com]]",
            });
          },
          onInit: async ({ vaults }) => {
            const editor = await VSCodeUtils.openNoteByPath({
              vault: vaults[0],
              fname: "source",
            });
            const provider = new ReferenceHoverProvider();
            const hover = await provider.provideHover(
              editor.document,
              new vscode.Position(7, 4)
            );
            expect(hover).toBeTruthy();
            await AssertUtils.assertInString({
              body: hover!.contents.join(""),
              match: ["[", "]", "(", "mailto:user@example.com", ")"],
            });
            done();
          },
        });
      });
    });
  });
});
