// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as LitHtml from '../../lit-html/lit-html.js';
import * as ComponentHelpers from '../helpers/helpers.js';
import * as Coordinator from '../render_coordinator/render_coordinator.js';

import * as LinkifierUtils from './LinkifierUtils.js';

const coordinator = Coordinator.RenderCoordinator.RenderCoordinator.instance();

export interface LinkifierData {
  url: string;
  lineNumber?: number;
  columnNumber?: number;
}

export class LinkifierClick extends Event {
  data: LinkifierData;

  constructor(data: LinkifierData) {
    super('linkifieractivated', {
      bubbles: true,
      composed: true,
    });
    this.data = data;
  }
}

export class Linkifier extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-linkifier`;

  private readonly shadow = this.attachShadow({mode: 'open'});
  private url: string = '';
  private lineNumber?: number;
  private columnNumber?: number;

  set data(data: LinkifierData) {
    this.url = data.url;
    this.lineNumber = data.lineNumber;
    this.columnNumber = data.columnNumber;

    if (!this.url) {
      throw new Error('Cannot construct a Linkifier without providing a valid string URL.');
    }

    this.render();
  }

  private onLinkActivation(event: Event): void {
    event.preventDefault();
    const linkifierClickEvent = new LinkifierClick({
      url: this.url,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
    });
    this.dispatchEvent(linkifierClickEvent);
  }

  private async render(): Promise<void> {
    // Disabled until https://crbug.com/1079231 is fixed.
    await coordinator.write(() => {
      // clang-format off
      LitHtml.render(LitHtml.html`
        <style>
          .link:link,
          .link:visited {
            color: var(--color-link);
            text-decoration: underline;
            cursor: pointer;
          }
        </style>
        <a class="link" href=${this.url} @click=${this.onLinkActivation}>${LinkifierUtils.linkText(this.url, this.lineNumber)}</a>
      `, this.shadow, { host: this});
      // clang-format on
    });
  }
}

ComponentHelpers.CustomElements.defineComponent('devtools-linkifier', Linkifier);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLElementTagNameMap {
    'devtools-linkifier': Linkifier;
  }
}
