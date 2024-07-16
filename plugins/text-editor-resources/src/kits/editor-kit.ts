//
// Copyright © 2023, 2024 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//
import { type Class, type Space, type Doc, type Ref } from '@hcengineering/core'
import { getResource } from '@hcengineering/platform'
import { type AnyExtension, Extension } from '@tiptap/core'
import { type Level } from '@tiptap/extension-heading'
import ListKeymap from '@tiptap/extension-list-keymap'
import TableHeader from '@tiptap/extension-table-header'

import 'prosemirror-codemark/dist/codemark.css'
import { getBlobRef, getClient } from '@hcengineering/presentation'
import { CodeBlockExtension, codeBlockOptions, CodeExtension, codeOptions } from '@hcengineering/text'
import textEditor, { type ExtensionCreator, type TextEditorMode } from '@hcengineering/text-editor'

import { DefaultKit, type DefaultKitOptions } from './default-kit'
import { HardBreakExtension } from '../components/extension/hardBreak'
import { FileExtension, type FileOptions } from '../components/extension/fileExt'
import { ImageExtension, type ImageOptions } from '../components/extension/imageExt'
import { NodeUuidExtension } from '../components/extension/nodeUuid'
import { Table, TableCell, TableRow } from '../components/extension/table'
import { SubmitExtension, type SubmitOptions } from '../components/extension/submit'
import { ParagraphExtension } from '../components/extension/paragraph'

const headingLevels: Level[] = [1, 2, 3]

export const tableKitExtensions: KitExtension[] = [
  [
    10,
    Table.configure({
      resizable: false,
      HTMLAttributes: {
        class: 'proseTable'
      }
    })
  ],
  [20, TableRow.configure({})],
  [30, TableHeader.configure({})],
  [40, TableCell.configure({})]
]

export interface EditorKitOptions extends DefaultKitOptions {
  history?: false
  file?: Partial<FileOptions> | false
  image?: Partial<ImageOptions> | false
  mode?: 'full' | 'compact'
  submit?: SubmitOptions | false
  objectId?: Ref<Doc>
  objectClass?: Ref<Class<Doc>>
  objectSpace?: Ref<Space>
}

/**
 * KitExtensionCreator is a tuple of an index and an ExtensionCreator.
 */
export type KitExtensionCreator = [number, ExtensionCreator]
export type KitExtension = [number, AnyExtension]

async function getKitExtensionCreators (): Promise<KitExtensionCreator[]> {
  const client = getClient()
  const extensionFactories = client.getModel().findAllSync(textEditor.class.TextEditorExtensionFactory, {})

  return await Promise.all(
    extensionFactories.map(async ({ index, create }) => {
      return [index, await getResource(create)]
    })
  )
}

let editorKitPromise: Promise<Extension<EditorKitOptions, any>>

export async function getEditorKit (): Promise<Extension<EditorKitOptions, any>> {
  if (editorKitPromise === undefined) {
    editorKitPromise = buildEditorKit()
  }

  return await editorKitPromise
}

async function buildEditorKit (): Promise<Extension<EditorKitOptions, any>> {
  return await new Promise<Extension<EditorKitOptions, any>>((resolve, reject) => {
    getKitExtensionCreators()
      .then((kitExtensionCreators) => {
        resolve(
          Extension.create<EditorKitOptions>({
            name: 'defaultKit',

            addExtensions () {
              const mode: TextEditorMode = this.options.mode ?? 'full'
              const modelKitExtensions: KitExtension[] = kitExtensionCreators
                .map(
                  ([idx, createExtension]) =>
                    [
                      idx,
                      createExtension(mode, {
                        objectId: this.options.objectId,
                        objectClass: this.options.objectClass,
                        objectSpace: this.options.objectSpace
                      })
                    ] as KitExtension
                )
                .filter(([_, ext]) => ext != null)

              const staticKitExtensions: KitExtension[] = [
                [
                  100,
                  DefaultKit.configure({
                    ...this.options,
                    code: false,
                    codeBlock: false,
                    hardBreak: false,
                    heading: {
                      levels: headingLevels
                    }
                  })
                ],
                [200, CodeBlockExtension.configure(codeBlockOptions)],
                [210, CodeExtension.configure(codeOptions)],
                [220, HardBreakExtension.configure({ shortcuts: mode })]
              ]

              if (this.options.submit !== false) {
                staticKitExtensions.push([
                  300,
                  SubmitExtension.configure({
                    useModKey: mode === 'full',
                    ...this.options.submit
                  })
                ])
              }

              if (mode === 'compact') {
                staticKitExtensions.push([400, ParagraphExtension.configure()])
              }

              staticKitExtensions.push([
                500,
                ListKeymap.configure({
                  listTypes: [
                    {
                      itemName: 'listItem',
                      wrapperNames: ['bulletList', 'orderedList']
                    },
                    {
                      itemName: 'taskItem',
                      wrapperNames: ['taskList']
                    },
                    {
                      itemName: 'todoItem',
                      wrapperNames: ['todoList']
                    }
                  ]
                })
              ])

              staticKitExtensions.push([600, NodeUuidExtension])

              if (this.options.file !== false) {
                staticKitExtensions.push([
                  700,
                  FileExtension.configure({
                    inline: true,
                    ...this.options.file
                  })
                ])
              }

              if (this.options.image !== false) {
                staticKitExtensions.push([
                  800,
                  ImageExtension.configure({
                    inline: true,
                    loadingImgSrc:
                      'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4NCjxzdmcgd2lkdGg9IjMycHgiIGhlaWdodD0iMzJweCIgdmlld0JveD0iMCAwIDE2IDE2IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPg0KICAgIDxwYXRoIGQ9Im0gNCAxIGMgLTEuNjQ0NTMxIDAgLTMgMS4zNTU0NjkgLTMgMyB2IDEgaCAxIHYgLTEgYyAwIC0xLjEwOTM3NSAwLjg5MDYyNSAtMiAyIC0yIGggMSB2IC0xIHogbSAyIDAgdiAxIGggNCB2IC0xIHogbSA1IDAgdiAxIGggMSBjIDEuMTA5Mzc1IDAgMiAwLjg5MDYyNSAyIDIgdiAxIGggMSB2IC0xIGMgMCAtMS42NDQ1MzEgLTEuMzU1NDY5IC0zIC0zIC0zIHogbSAtNSA0IGMgLTAuNTUwNzgxIDAgLTEgMC40NDkyMTkgLTEgMSBzIDAuNDQ5MjE5IDEgMSAxIHMgMSAtMC40NDkyMTkgMSAtMSBzIC0wLjQ0OTIxOSAtMSAtMSAtMSB6IG0gLTUgMSB2IDQgaCAxIHYgLTQgeiBtIDEzIDAgdiA0IGggMSB2IC00IHogbSAtNC41IDIgbCAtMiAyIGwgLTEuNSAtMSBsIC0yIDIgdiAwLjUgYyAwIDAuNSAwLjUgMC41IDAuNSAwLjUgaCA3IHMgMC40NzI2NTYgLTAuMDM1MTU2IDAuNSAtMC41IHYgLTEgeiBtIC04LjUgMyB2IDEgYyAwIDEuNjQ0NTMxIDEuMzU1NDY5IDMgMyAzIGggMSB2IC0xIGggLTEgYyAtMS4xMDkzNzUgMCAtMiAtMC44OTA2MjUgLTIgLTIgdiAtMSB6IG0gMTMgMCB2IDEgYyAwIDEuMTA5Mzc1IC0wLjg5MDYyNSAyIC0yIDIgaCAtMSB2IDEgaCAxIGMgMS42NDQ1MzEgMCAzIC0xLjM1NTQ2OSAzIC0zIHYgLTEgeiBtIC04IDMgdiAxIGggNCB2IC0xIHogbSAwIDAiIGZpbGw9IiMyZTM0MzQiIGZpbGwtb3BhY2l0eT0iMC4zNDkwMiIvPg0KPC9zdmc+DQo=',
                    getBlobRef: async (file, name, size) => await getBlobRef(undefined, file, name, size),
                    ...this.options.image
                  })
                ])
              }

              const allKitExtensions = [...tableKitExtensions, ...modelKitExtensions, ...staticKitExtensions]

              allKitExtensions.sort((a, b) => a[0] - b[0])

              return allKitExtensions.map(([_, ext]) => ext)
            }
          })
        )
      })
      .catch((err) => {
        reject(err)
      })
  })
}