// Copyright 2019 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


import './BinaryResourceView.js';
import './BlockedURLsPane.js';
import './EventSourceMessagesView.js';
import './NetworkConfigView.js';
import './NetworkDataGridNode.js';
import './NetworkItemView.js';
import './NetworkTimeCalculator.js';
import './NetworkLogView.js';
import './NetworkLogViewColumns.js';
import './NetworkFrameGrouper.js';
import './NetworkManageCustomHeadersView.js';
import './NetworkSearchScope.js';
import './NetworkWaterfallColumn.js';
import './RequestCookiesView.js';
import './RequestHeadersView.js';
import './RequestHTMLView.js';
import './RequestInitiatorView.js';
import './RequestResponseView.js';
import './RequestPreviewView.js';
import './RequestTimingView.js';
import './ResourceWebSocketFrameView.js';
import './SignedExchangeInfoView.js';
import './NetworkOverview.js';
import './NetworkPanel.js';

import * as BinaryResourceView from './BinaryResourceView.js';
import * as BlockedURLsPane from './BlockedURLsPane.js';
import * as EventSourceMessagesView from './EventSourceMessagesView.js';
import * as NetworkConfigView from './NetworkConfigView.js';
import * as NetworkDataGridNode from './NetworkDataGridNode.js';
import * as NetworkFrameGrouper from './NetworkFrameGrouper.js';
import * as NetworkItemView from './NetworkItemView.js';
import * as NetworkLogView from './NetworkLogView.js';
import * as NetworkLogViewColumns from './NetworkLogViewColumns.js';
import * as NetworkManageCustomHeadersView from './NetworkManageCustomHeadersView.js';
import * as NetworkOverview from './NetworkOverview.js';
import * as NetworkPanel from './NetworkPanel.js';
import * as NetworkSearchScope from './NetworkSearchScope.js';
import * as NetworkTimeCalculator from './NetworkTimeCalculator.js';
import * as NetworkWaterfallColumn from './NetworkWaterfallColumn.js';
import * as RequestCookiesView from './RequestCookiesView.js';
import * as RequestHeadersView from './RequestHeadersView.js';
import * as RequestHTMLView from './RequestHTMLView.js';
import * as RequestInitiatorView from './RequestInitiatorView.js';
import * as RequestPreviewView from './RequestPreviewView.js';
import * as RequestResponseView from './RequestResponseView.js';
import * as RequestTimingView from './RequestTimingView.js';
import * as ResourceWebSocketFrameView from './ResourceWebSocketFrameView.js';
import * as SignedExchangeInfoView from './SignedExchangeInfoView.js';

export {
  BinaryResourceView,
  BlockedURLsPane,
  EventSourceMessagesView,
  NetworkConfigView,
  NetworkDataGridNode,
  NetworkFrameGrouper,
  NetworkItemView,
  NetworkLogView,
  NetworkLogViewColumns,
  NetworkManageCustomHeadersView,
  NetworkOverview,
  NetworkPanel,
  NetworkSearchScope,
  NetworkTimeCalculator,
  NetworkWaterfallColumn,
  RequestCookiesView,
  RequestHeadersView,
  RequestHTMLView,
  RequestInitiatorView,
  RequestPreviewView,
  RequestResponseView,
  RequestTimingView,
  ResourceWebSocketFrameView,
  SignedExchangeInfoView,
};

/**
 * This function exists to break a circular dependency from Cookie Table. In order to reveal
 * requests from the Cookie Table in the Network Panel, the Cookie Table dispatches an event
 * which is picked up here and used to load the Network Panel instance.
 */
const onRevealAndFilter = (evt: CustomEvent<{filterType: NetworkLogView.FilterType, filterValue: string}[]>): void => {
  NetworkPanel.NetworkPanel.revealAndFilter(evt.detail);
};

// TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
// @ts-expect-error
document.body.addEventListener('networkrevealandfilter', onRevealAndFilter);
