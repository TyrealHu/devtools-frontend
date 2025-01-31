// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../../core/common/common.js';
import * as Host from '../../core/host/host.js';
import * as i18n from '../../core/i18n/i18n.js';
import type * as Platform from '../../core/platform/platform.js';
import * as SDK from '../../core/sdk/sdk.js';
import type * as IssuesManager from '../../models/issues_manager/issues_manager.js';

import {AffectedItem, AffectedResourcesView} from './AffectedResourcesView.js';
import type {IssueView} from './IssueView.js';

const UIStrings = {
  /**
  *@description Noun for singular or plural number of affected element resource indication in issue view.
  */
  nElements: '{n, plural, =1 {# element} other {# elements}}',
  /**
  *@description Replacement text for a link to an HTML element which is not available (anymore).
  */
  unavailable: 'unavailable',
};
const str_ = i18n.i18n.registerUIStrings('panels/issues/AffectedElementsView.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
export class AffectedElementsView extends AffectedResourcesView {
  private issue: IssuesManager.Issue.Issue;

  constructor(parent: IssueView, issue: IssuesManager.Issue.Issue) {
    super(parent);
    this.issue = issue;
  }

  private sendTelemetry(): void {
    Host.userMetrics.issuesPanelResourceOpened(this.issue.getCategory(), AffectedItem.Element);
  }

  private async appendAffectedElements(affectedElements: Iterable<IssuesManager.Issue.AffectedElement>): Promise<void> {
    let count = 0;
    for (const element of affectedElements) {
      await this.appendAffectedElement(element);
      count++;
    }
    this.updateAffectedResourceCount(count);
  }

  protected getResourceNameWithCount(count: number): Platform.UIString.LocalizedString {
    return i18nString(UIStrings.nElements, {n: count});
  }

  private async appendAffectedElement(element: IssuesManager.Issue.AffectedElement): Promise<void> {
    const cellElement = await this.renderElementCell(element);
    const rowElement = document.createElement('tr');
    rowElement.appendChild(cellElement);
    this.affectedResources.appendChild(rowElement);
  }

  protected async renderElementCell({backendNodeId, nodeName, target}: IssuesManager.Issue.AffectedElement):
      Promise<Element> {
    if (!target) {
      const cellElement = document.createElement('td');
      cellElement.textContent = nodeName || i18nString(UIStrings.unavailable);
      return cellElement;
    }
    const deferredDOMNode = new SDK.DOMModel.DeferredDOMNode(target, backendNodeId);
    const anchorElement = (await Common.Linkifier.Linkifier.linkify(deferredDOMNode)) as HTMLElement;
    anchorElement.textContent = nodeName;
    anchorElement.addEventListener('click', () => this.sendTelemetry());
    anchorElement.addEventListener('keydown', (event: Event) => {
      if ((event as KeyboardEvent).key === 'Enter') {
        this.sendTelemetry();
      }
    });
    const cellElement = document.createElement('td');
    cellElement.classList.add('affected-resource-element', 'devtools-link');
    cellElement.appendChild(anchorElement);
    return cellElement;
  }

  update(): void {
    this.clear();
    this.appendAffectedElements(this.issue.elements());
  }
}
