// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../../core/i18n/i18n.js';
import type * as SDK from '../../../core/sdk/sdk.js'; // eslint-disable-line no-unused-vars
import * as ExpandableList from '../../../ui/components/expandable_list/expandable_list.js';
import * as ComponentHelpers from '../../../ui/components/helpers/helpers.js';
import * as Components from '../../../ui/legacy/components/utils/utils.js';
import * as LitHtml from '../../../ui/lit-html/lit-html.js';
import type * as Protocol from '../../../generated/protocol.js';

const UIStrings = {
  /**
  *@description Error message stating that something went wrong when tring to render stack trace
  */
  cannotRenderStackTrace: 'Cannot render stack trace',
  /**
  *@description A link to show more frames in the stack trace if more are available. Never 0.
  */
  showSMoreFrames: '{n, plural, =1 {Show # more frame} other {Show # more frames}}',
};
const str_ = i18n.i18n.registerUIStrings('panels/application/components/StackTrace.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

export interface StackTraceData {
  frame: SDK.ResourceTreeModel.ResourceTreeFrame;
  buildStackTraceRows: (
      stackTrace: Protocol.Runtime.StackTrace,
      target: SDK.Target.Target|null,
      linkifier: Components.Linkifier.Linkifier,
      tabStops: boolean|undefined,
      updateCallback?: (arg0: (Components.JSPresentationUtils.StackTraceRegularRow|
                               Components.JSPresentationUtils.StackTraceAsyncRow)[]) => void,
      ) => (Components.JSPresentationUtils.StackTraceRegularRow | Components.JSPresentationUtils.StackTraceAsyncRow)[];
}

export class StackTrace extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-resources-stack-trace`;

  private readonly shadow = this.attachShadow({mode: 'open'});
  private readonly linkifier = new Components.Linkifier.Linkifier();
  private stackTraceRows: (Components.JSPresentationUtils.StackTraceRegularRow|
                           Components.JSPresentationUtils.StackTraceAsyncRow)[] = [];
  private showHidden = false;

  set data(data: StackTraceData) {
    const frame = data.frame;
    const {creationStackTrace, creationStackTraceTarget} = frame.getCreationStackTraceData();
    if (creationStackTrace) {
      this.stackTraceRows = data.buildStackTraceRows(
          creationStackTrace, creationStackTraceTarget, this.linkifier, true, this.onStackTraceRowsUpdated.bind(this));
    }
    this.render();
  }

  private onStackTraceRowsUpdated(stackTraceRows: (Components.JSPresentationUtils.StackTraceRegularRow|
                                                   Components.JSPresentationUtils.StackTraceAsyncRow)[]): void {
    this.stackTraceRows = stackTraceRows;
    this.render();
  }

  private onShowAllClick(): void {
    this.showHidden = true;
    this.render();
  }

  createRowTemplates(): LitHtml.TemplateResult[] {
    const expandableRows = [];
    let hiddenCallFramesCount = 0;
    for (const item of this.stackTraceRows) {
      if (this.showHidden || (!item.ignoreListHide && !item.rowCountHide)) {
        if ('functionName' in item) {
          expandableRows.push(LitHtml.html`
            <style>
              .stack-trace-row {
                display: flex;
              }

              .stack-trace-function-name {
                width: 100px;
              }

              .stack-trace-source-location {
                display: flex;
                overflow: hidden;
              }

              .text-ellipsis {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }

              .ignore-list-link {
                opacity: 60%;
              }
            </style>
            <div class="stack-trace-row">
              <div class="stack-trace-function-name text-ellipsis" title="${item.functionName}">
                ${item.functionName}
              </div>
              <div class="stack-trace-source-location">
                ${item.link ? LitHtml.html`<div class="text-ellipsis">\xA0@\xA0${item.link}</div>` : LitHtml.nothing}
              </div>
            </div>
          `);
        }
        if ('asyncDescription' in item) {
          expandableRows.push(LitHtml.html`
            <div>${item.asyncDescription}</div>
          `);
        }
      }
      if (!this.showHidden && 'functionName' in item && (item.ignoreListHide || item.rowCountHide)) {
        hiddenCallFramesCount++;
      }
    }
    if (hiddenCallFramesCount) {
      // Disabled until https://crbug.com/1079231 is fixed.
      // clang-format off
      expandableRows.push(LitHtml.html`
        <style>
          button.link {
            color: var(--color-link);
            text-decoration: underline;
            cursor: pointer;
            padding: 2px 0; /* adjust focus ring size */
            border: none;
            background: none;
            font-family: inherit;
            font-size: inherit;
          }
        </style>
        <div class="stack-trace-row">
          <button class="link" @click=${(): void => this.onShowAllClick()}>
            ${i18nString(UIStrings.showSMoreFrames, {n: hiddenCallFramesCount})}
          </button>
        </div>
      `);
      // clang-format on
    }
    return expandableRows;
  }

  private render(): void {
    if (!this.stackTraceRows.length) {
      // Disabled until https://crbug.com/1079231 is fixed.
      // clang-format off
      LitHtml.render(
        LitHtml.html`
          <span>${i18nString(UIStrings.cannotRenderStackTrace)}</span>
        `,
        this.shadow);
      return;
    }
    const expandableRows = this.createRowTemplates();
    LitHtml.render(
      LitHtml.html`
        <${ExpandableList.ExpandableList.ExpandableList.litTagName} .data=${{
          rows: expandableRows,
        } as ExpandableList.ExpandableList.ExpandableListData}>
        </${ExpandableList.ExpandableList.ExpandableList.litTagName}>
      `,
      this.shadow);
    // clang-format on
  }
}

ComponentHelpers.CustomElements.defineComponent('devtools-resources-stack-trace', StackTrace);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLElementTagNameMap {
    'devtools-resources-stack-trace': StackTrace;
  }
}
