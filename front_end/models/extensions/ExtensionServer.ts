/*
 * Copyright (C) 2011 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// @ts-nocheck
// TODO(crbug.com/1011811): Enable TypeScript compiler checks

// TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/naming-convention,rulesdir/no_underscored_properties */


import * as Common from '../../core/common/common.js';
import * as Host from '../../core/host/host.js';
import * as Platform from '../../core/platform/platform.js';
import * as _ProtocolClient from '../../core/protocol_client/protocol_client.js';  // eslint-disable-line @typescript-eslint/no-unused-vars
import * as Root from '../../core/root/root.js';                                   // eslint-disable-line no-unused-vars
import * as SDK from '../../core/sdk/sdk.js';
import * as Logs from '../../models/logs/logs.js';
import * as Components from '../../ui/legacy/components/utils/utils.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as ThemeSupport from '../../ui/legacy/theme_support/theme_support.js';
import * as Bindings from '../bindings/bindings.js';
import * as HAR from '../har/har.js';
import type * as TextUtils from '../text_utils/text_utils.js'; // eslint-disable-line no-unused-vars
import * as Workspace from '../workspace/workspace.js';
import type * as Protocol from '../../generated/protocol.js';

import {ExtensionButton, ExtensionPanel, ExtensionSidebarPane} from './ExtensionPanel.js';
import type {TracingSession} from './ExtensionTraceProvider.js';
import {ExtensionTraceProvider} from './ExtensionTraceProvider.js';  // eslint-disable-line no-unused-vars
import {LanguageExtensionEndpoint} from './LanguageExtensionEndpoint.js';

const extensionOriginSymbol = Symbol('extensionOrigin');

const kAllowedOrigins = [
  'chrome://newtab',
  'chrome://new-tab-page',
].map(url => (new URL(url)).origin);

let extensionServerInstance: ExtensionServer|null;

export class ExtensionServer extends Common.ObjectWrapper.ObjectWrapper {
  _clientObjects: {};
  _handlers: {};
  _subscribers: Map<string, Set<MessagePort>>;
  _subscriptionStartHandlers: {};
  _subscriptionStopHandlers: {};
  _extraHeaders: Map<string, Map<string, any>>;
  _requests: {};
  _lastRequestId: number;
  _registeredExtensions: Map<string, {
    name: string,
  }>;
  _status: ExtensionStatus;
  _sidebarPanes: ExtensionSidebarPane[];
  _traceProviders: ExtensionTraceProvider[];
  _traceSessions: Map<string, TracingSession>;
  _extensionsEnabled: boolean;
  _languageExtensionRequests: Map<any, any>;
  _inspectedTabId?: string;
  private constructor() {
    super();
    this._clientObjects = {};
    this._handlers = {};
    this._subscribers = new Map();
    this._subscriptionStartHandlers = {};
    this._subscriptionStopHandlers = {};
    this._extraHeaders = new Map();
    this._requests = {};
    this._lastRequestId = 0;
    this._registeredExtensions = new Map();
    this._status = new ExtensionStatus();
    this._sidebarPanes = [];
    this._traceProviders = [];
    this._traceSessions = new Map();
    // TODO(caseq): properly unload extensions when we disable them.
    this._extensionsEnabled = true;

    const commands = Extensions.extensionAPI.Commands;

    this._registerHandler(commands.AddRequestHeaders, this._onAddRequestHeaders.bind(this));
    this._registerHandler(commands.AddTraceProvider, this._onAddTraceProvider.bind(this));
    this._registerHandler(commands.ApplyStyleSheet, this._onApplyStyleSheet.bind(this));
    this._registerHandler(commands.CompleteTraceSession, this._onCompleteTraceSession.bind(this));
    this._registerHandler(commands.CreatePanel, this._onCreatePanel.bind(this));
    this._registerHandler(commands.CreateSidebarPane, this._onCreateSidebarPane.bind(this));
    this._registerHandler(commands.CreateToolbarButton, this._onCreateToolbarButton.bind(this));
    this._registerHandler(commands.EvaluateOnInspectedPage, this._onEvaluateOnInspectedPage.bind(this));
    this._registerHandler(commands.ForwardKeyboardEvent, this._onForwardKeyboardEvent.bind(this));
    this._registerHandler(commands.GetHAR, this._onGetHAR.bind(this));
    this._registerHandler(commands.GetPageResources, this._onGetPageResources.bind(this));
    this._registerHandler(commands.GetRequestContent, this._onGetRequestContent.bind(this));
    this._registerHandler(commands.GetResourceContent, this._onGetResourceContent.bind(this));
    this._registerHandler(commands.Reload, this._onReload.bind(this));
    this._registerHandler(commands.SetOpenResourceHandler, this._onSetOpenResourceHandler.bind(this));
    this._registerHandler(commands.SetResourceContent, this._onSetResourceContent.bind(this));
    this._registerHandler(commands.SetSidebarHeight, this._onSetSidebarHeight.bind(this));
    this._registerHandler(commands.SetSidebarContent, this._onSetSidebarContent.bind(this));
    this._registerHandler(commands.SetSidebarPage, this._onSetSidebarPage.bind(this));
    this._registerHandler(commands.ShowPanel, this._onShowPanel.bind(this));
    this._registerHandler(commands.Subscribe, this._onSubscribe.bind(this));
    this._registerHandler(commands.OpenResource, this._onOpenResource.bind(this));
    this._registerHandler(commands.Unsubscribe, this._onUnsubscribe.bind(this));
    this._registerHandler(commands.UpdateButton, this._onUpdateButton.bind(this));
    this._registerHandler(commands.RegisterLanguageExtensionPlugin, this._registerLanguageExtensionEndpoint.bind(this));
    window.addEventListener('message', this._onWindowMessage.bind(this), false);  // Only for main window.

    const existingTabId =
        window.DevToolsAPI && window.DevToolsAPI.getInspectedTabId && window.DevToolsAPI.getInspectedTabId();

    if (existingTabId) {
      this._setInspectedTabId({data: existingTabId});
    }
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(
        Host.InspectorFrontendHostAPI.Events.SetInspectedTabId, this._setInspectedTabId, this);

    this._languageExtensionRequests = new Map();
    this._initExtensions();
  }

  static instance(opts: {
    forceNew: boolean|null,
  } = {forceNew: null}): ExtensionServer {
    const {forceNew} = opts;
    if (!extensionServerInstance || forceNew) {
      extensionServerInstance = new ExtensionServer();
    }

    return extensionServerInstance;
  }

  initializeExtensions(): void {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.setAddExtensionCallback(this._addExtension.bind(this));
  }

  hasExtensions(): boolean {
    return Boolean(this._registeredExtensions.size);
  }

  notifySearchAction(panelId: string, action: string, searchString?: string): void {
    this._postNotification(Extensions.extensionAPI.Events.PanelSearch + panelId, action, searchString);
  }

  notifyViewShown(identifier: string, frameIndex?: number): void {
    this._postNotification(Extensions.extensionAPI.Events.ViewShown + identifier, frameIndex);
  }

  notifyViewHidden(identifier: string): void {
    this._postNotification(Extensions.extensionAPI.Events.ViewHidden + identifier);
  }

  notifyButtonClicked(identifier: string): void {
    this._postNotification(Extensions.extensionAPI.Events.ButtonClicked + identifier);
  }

  _registerLanguageExtensionEndpoint(message: any, _shared_port: any): Record {
    const {pluginManager} = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance();
    if (!pluginManager) {
      return this._status.E_FAILED('WebAssembly DWARF support needs to be enabled to use this extension');
    }

    const {pluginName, port, supportedScriptTypes: {language, symbol_types}} = message;
    const symbol_types_array =
        (Array.isArray(symbol_types) && symbol_types.every(e => typeof e === 'string') ? symbol_types : [] as any);
    const endpoint = new LanguageExtensionEndpoint(pluginName, {language, symbol_types: symbol_types_array}, port);
    pluginManager.addPlugin(endpoint);
    return this._status.OK();
  }

  _inspectedURLChanged(event: any): void {
    if (!this._canInspectURL(event.data.inspectedURL())) {
      this._disableExtensions();
      return;
    }
    if (event.data !== SDK.TargetManager.TargetManager.instance().mainTarget()) {
      return;
    }
    this._requests = {};
    const url = event.data.inspectedURL();
    this._postNotification(Extensions.extensionAPI.Events.InspectedURLChanged, url);
  }

  startTraceRecording(providerId: string, sessionId: string, session: TracingSession): void {
    this._traceSessions.set(sessionId, session);
    this._postNotification('trace-recording-started-' + providerId, sessionId);
  }

  stopTraceRecording(providerId: string): void {
    this._postNotification('trace-recording-stopped-' + providerId);
  }

  hasSubscribers(type: string): boolean {
    return this._subscribers.has(type);
  }

  _postNotification(type: string, _vararg: any): void {
    if (!this._extensionsEnabled) {
      return;
    }
    const subscribers = this._subscribers.get(type);
    if (!subscribers) {
      return;
    }
    const message = {command: 'notify-' + type, arguments: Array.prototype.slice.call(arguments, 1)};
    for (const subscriber of subscribers) {
      subscriber.postMessage(message);
    }
  }

  _onSubscribe(message: any, port: any): void {
    const subscribers = this._subscribers.get(message.type);
    if (subscribers) {
      subscribers.add(port);
    } else {
      this._subscribers.set(message.type, new Set([port]));
      if (this._subscriptionStartHandlers[message.type]) {
        this._subscriptionStartHandlers[message.type]();
      }
    }
  }

  _onUnsubscribe(message: any, port: any): void {
    const subscribers = this._subscribers.get(message.type);
    if (!subscribers) {
      return;
    }
    subscribers.delete(port);
    if (!subscribers.size) {
      this._subscribers.delete(message.type);
      if (this._subscriptionStopHandlers[message.type]) {
        this._subscriptionStopHandlers[message.type]();
      }
    }
  }

  _onAddRequestHeaders(message: any): Record|undefined {
    const id = message.extensionId;
    if (typeof id !== 'string') {
      return this._status.E_BADARGTYPE('extensionId', typeof id, 'string');
    }
    let extensionHeaders = this._extraHeaders.get(id);
    if (!extensionHeaders) {
      extensionHeaders = new Map();
      this._extraHeaders.set(id, extensionHeaders);
    }
    for (const name in message.headers) {
      extensionHeaders.set(name, message.headers[name]);
    }
    const allHeaders = ({} as Protocol.Network.Headers);
    for (const headers of this._extraHeaders.values()) {
      for (const name of headers.keys()) {
        if (name !== '__proto__' && typeof headers.get(name) === 'string') {
          allHeaders[name] = headers.get(name);
        }
      }
    }

    SDK.NetworkManager.MultitargetNetworkManager.instance().setExtraHTTPHeaders(allHeaders);
  }

  _onApplyStyleSheet(message: any): void {
    if (!Root.Runtime.experiments.isEnabled('applyCustomStylesheet')) {
      return;
    }
    const styleSheet = createElement('style');
    styleSheet.textContent = message.styleSheet;
    document.head.appendChild(styleSheet);

    ThemeSupport.ThemeSupport.instance().addCustomStylesheet(message.styleSheet);
    // Add to all the shadow roots that have already been created
    for (let node: (Node|null)|HTMLElement = document.body; node; node = node.traverseNextNode(document.body)) {
      if (node instanceof ShadowRoot) {
        ThemeSupport.ThemeSupport.instance().injectCustomStyleSheets(node);
      }
    }
  }

  _onCreatePanel(message: any, port: any): Record {
    const id = message.id;
    // The ids are generated on the client API side and must be unique, so the check below
    // shouldn't be hit unless someone is bypassing the API.
    if (id in this._clientObjects || UI.InspectorView.InspectorView.instance().hasPanel(id)) {
      return this._status.E_EXISTS(id);
    }

    const page = this._expandResourcePath(port[extensionOriginSymbol], message.page);
    let persistentId = port[extensionOriginSymbol] + message.title;
    persistentId = persistentId.replace(/\s/g, '');
    const panelView =
        new ExtensionServerPanelView(persistentId, message.title, new ExtensionPanel(this, persistentId, id, page));
    this._clientObjects[id] = panelView;
    UI.InspectorView.InspectorView.instance().addPanel(panelView);
    return this._status.OK();
  }

  _onShowPanel(message: any): void {
    let panelViewId = message.id;
    const panelView = this._clientObjects[message.id];
    if (panelView && panelView instanceof ExtensionServerPanelView) {
      panelViewId = panelView.viewId();
    }
    UI.InspectorView.InspectorView.instance().showPanel(panelViewId);
  }

  _onCreateToolbarButton(message: any, port: any): Record {
    const panelView = this._clientObjects[message.panel];
    if (!panelView || !(panelView instanceof ExtensionServerPanelView)) {
      return this._status.E_NOTFOUND(message.panel);
    }
    const button = new ExtensionButton(
        this, message.id, this._expandResourcePath(port[extensionOriginSymbol], message.icon), message.tooltip,
        message.disabled);
    this._clientObjects[message.id] = button;

    panelView.widget().then(appendButton);

    function appendButton(panel: UI.Widget.Widget): void {
      (panel as ExtensionPanel).addToolbarItem(button.toolbarButton());
    }

    return this._status.OK();
  }

  _onUpdateButton(message: any, port: any): Record {
    const button = this._clientObjects[message.id];
    if (!button || !(button instanceof ExtensionButton)) {
      return this._status.E_NOTFOUND(message.id);
    }
    button.update(
        this._expandResourcePath(port[extensionOriginSymbol], message.icon), message.tooltip, message.disabled);
    return this._status.OK();
  }

  _onCompleteTraceSession(message: Object): Record|undefined {
    const session = this._traceSessions.get(message.id);
    if (!session) {
      return this._status.E_NOTFOUND(message.id);
    }
    this._traceSessions.delete(message.id);
    session.complete(message.url, message.timeOffset);
  }

  _onCreateSidebarPane(message: any): Record {
    if (message.panel !== 'elements' && message.panel !== 'sources') {
      return this._status.E_NOTFOUND(message.panel);
    }
    const id = message.id;
    const sidebar = new ExtensionSidebarPane(this, message.panel, message.title, id);
    this._sidebarPanes.push(sidebar);
    this._clientObjects[id] = sidebar;
    this.dispatchEventToListeners(Events.SidebarPaneAdded, sidebar);

    return this._status.OK();
  }

  sidebarPanes(): ExtensionSidebarPane[] {
    return this._sidebarPanes;
  }

  _onSetSidebarHeight(message: any): Record {
    const sidebar = this._clientObjects[message.id];
    if (!sidebar) {
      return this._status.E_NOTFOUND(message.id);
    }
    sidebar.setHeight(message.height);
    return this._status.OK();
  }

  _onSetSidebarContent(message: any, port: any): any {
    const sidebar = this._clientObjects[message.id];
    if (!sidebar) {
      return this._status.E_NOTFOUND(message.id);
    }

    function callback(this: ExtensionServer, error: any): void {
      const result = error ? this._status.E_FAILED(error) : this._status.OK();
      this._dispatchCallback(message.requestId, port, result);
    }
    if (message.evaluateOnPage) {
      return sidebar.setExpression(
          message.expression, message.rootTitle, message.evaluateOptions, port[extensionOriginSymbol],
          callback.bind(this));
    }
    sidebar.setObject(message.expression, message.rootTitle, callback.bind(this));
  }

  _onSetSidebarPage(message: any, port: any): Record|undefined {
    const sidebar = this._clientObjects[message.id];
    if (!sidebar) {
      return this._status.E_NOTFOUND(message.id);
    }
    sidebar.setPage(this._expandResourcePath(port[extensionOriginSymbol], message.page));
  }

  _onOpenResource(message: any): Record {
    const uiSourceCode = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(message.url);
    if (uiSourceCode) {
      Common.Revealer.reveal(uiSourceCode.uiLocation(message.lineNumber, 0));
      return this._status.OK();
    }

    const resource = Bindings.ResourceUtils.resourceForURL(message.url);
    if (resource) {
      Common.Revealer.reveal(resource);
      return this._status.OK();
    }

    const request = Logs.NetworkLog.NetworkLog.instance().requestForURL(message.url);
    if (request) {
      Common.Revealer.reveal(request);
      return this._status.OK();
    }

    return this._status.E_NOTFOUND(message.url);
  }

  _onSetOpenResourceHandler(message: any, port: any): void {
    const name = this._registeredExtensions.get(port[extensionOriginSymbol]).name;
    if (message.handlerPresent) {
      Components.Linkifier.Linkifier.registerLinkHandler(name, this._handleOpenURL.bind(this, port));
    } else {
      Components.Linkifier.Linkifier.unregisterLinkHandler(name);
    }
  }

  _handleOpenURL(port: any, contentProvider: any, lineNumber: any): void {
    port.postMessage(
        {command: 'open-resource', resource: this._makeResource(contentProvider), lineNumber: lineNumber + 1});
  }

  _onReload(message: any): Record {
    const options = (message.options || {} as any);

    SDK.NetworkManager.MultitargetNetworkManager.instance().setUserAgentOverride(
        typeof options.userAgent === 'string' ? options.userAgent : '', null);
    let injectedScript;
    if (options.injectedScript) {
      injectedScript = '(function(){' + options.injectedScript + '})()';
    }
    SDK.ResourceTreeModel.ResourceTreeModel.reloadAllPages(Boolean(options.ignoreCache), injectedScript);
    return this._status.OK();
  }

  _onEvaluateOnInspectedPage(message: any, port: any): Record|undefined {
    function callback(
        this: ExtensionServer, error: string|null, object: SDK.RemoteObject.RemoteObject|null,
        wasThrown: boolean): void {
      let result;
      if (error || !object) {
        result = this._status.E_PROTOCOLERROR(error.toString());
      } else if (wasThrown) {
        result = {isException: true, value: object.description};
      } else {
        result = {value: object.value};
      }

      this._dispatchCallback(message.requestId, port, result);
    }
    return this.evaluate(
        message.expression, true, true, message.evaluateOptions, port[extensionOriginSymbol], callback.bind(this));
  }

  async _onGetHAR(): Promise<HAR.Log.LogDTO> {
    const requests = Logs.NetworkLog.NetworkLog.instance().requests();
    const harLog = await HAR.Log.Log.build(requests);
    for (let i = 0; i < harLog.entries.length; ++i) {
      harLog.entries[i]._requestId = this._requestId(requests[i]);
    }
    return harLog;
  }

  _makeResource(contentProvider: TextUtils.ContentProvider.ContentProvider): {
    url: string,
    type: string,
  } {
    return {url: contentProvider.contentURL(), type: contentProvider.contentType().name()};
  }

  _onGetPageResources(): TextUtils.ContentProvider.ContentProvider[] {
    const resources = new Map<any, {
      url: string,
      type: string,
    }>();

    function pushResourceData(this: ExtensionServer, contentProvider: any): void {
      if (!resources.has(contentProvider.contentURL())) {
        resources.set(contentProvider.contentURL(), this._makeResource(contentProvider));
      }
    }
    let uiSourceCodes = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodesForProjectType(
        Workspace.Workspace.projectTypes.Network);
    uiSourceCodes = uiSourceCodes.concat(Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodesForProjectType(
        Workspace.Workspace.projectTypes.ContentScripts));
    uiSourceCodes.forEach(pushResourceData.bind(this));
    for (const resourceTreeModel of SDK.TargetManager.TargetManager.instance().models(
             SDK.ResourceTreeModel.ResourceTreeModel)) {
      resourceTreeModel.forAllResources(pushResourceData.bind(this));
    }
    return [...resources.values()];
  }

  async _getResourceContent(
      contentProvider: TextUtils.ContentProvider.ContentProvider, message: Object, port: MessagePort): Promise<void> {
    const {content} = await contentProvider.requestContent();
    const encoded = await contentProvider.contentEncoded();
    this._dispatchCallback(message.requestId, port, {encoding: encoded ? 'base64' : '', content: content});
  }

  _onGetRequestContent(message: any, port: any): Record|undefined {
    const request = this._requestById(message.id);
    if (!request) {
      return this._status.E_NOTFOUND(message.id);
    }
    this._getResourceContent(request, message, port);
  }

  _onGetResourceContent(message: any, port: any): Record|undefined {
    const url = (message.url as string);
    const contentProvider = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(url) ||
        Bindings.ResourceUtils.resourceForURL(url);
    if (!contentProvider) {
      return this._status.E_NOTFOUND(url);
    }
    this._getResourceContent(contentProvider, message, port);
  }

  _onSetResourceContent(message: any, port: any): Record|undefined {
    function callbackWrapper(this: ExtensionServer, error: string|null): void {
      const response = error ? this._status.E_FAILED(error) : this._status.OK();
      this._dispatchCallback(message.requestId, port, response);
    }

    const url = (message.url as string);
    const uiSourceCode = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(url);
    if (!uiSourceCode || !uiSourceCode.contentType().isDocumentOrScriptOrStyleSheet()) {
      const resource = SDK.ResourceTreeModel.ResourceTreeModel.resourceForURL(url);
      if (!resource) {
        return this._status.E_NOTFOUND(url);
      }
      return this._status.E_NOTSUPPORTED('Resource is not editable');
    }
    uiSourceCode.setWorkingCopy(message.content);
    if (message.commit) {
      uiSourceCode.commitWorkingCopy();
    }
    callbackWrapper.call(this, null);
  }

  _requestId(request: any): any {
    if (!request._extensionRequestId) {
      request._extensionRequestId = ++this._lastRequestId;
      this._requests[request._extensionRequestId] = request;
    }
    return request._extensionRequestId;
  }

  _requestById(id: any): any {
    return this._requests[id];
  }

  _onAddTraceProvider(message: Object, port: MessagePort): void {
    const provider = new ExtensionTraceProvider(
        port[extensionOriginSymbol], message.id, message.categoryName, message.categoryTooltip);
    this._clientObjects[message.id] = provider;
    this._traceProviders.push(provider);
    this.dispatchEventToListeners(Events.TraceProviderAdded, provider);
  }

  traceProviders(): ExtensionTraceProvider[] {
    return this._traceProviders;
  }

  _onForwardKeyboardEvent(message: any): void {
    message.entries.forEach(handleEventEntry);

    function handleEventEntry(entry: any): void {
      // Fool around closure compiler -- it has its own notion of both KeyboardEvent constructor
      // and initKeyboardEvent methods and overriding these in externs.js does not have effect.
      const event = new window.KeyboardEvent(entry.eventType, {
        key: entry.key,
        code: entry.code,
        keyCode: entry.keyCode,
        location: entry.location,
        ctrlKey: entry.ctrlKey,
        altKey: entry.altKey,
        shiftKey: entry.shiftKey,
        metaKey: entry.metaKey,
      });
      event.__keyCode = keyCodeForEntry(entry);
      document.dispatchEvent(event);
    }

    function keyCodeForEntry(entry: any): any {
      let keyCode = entry.keyCode;
      if (!keyCode) {
        // This is required only for synthetic events (e.g. dispatched in tests).
        if (entry.key === 'Escape') {
          keyCode = 27;
        }
      }
      return keyCode || 0;
    }
  }

  _dispatchCallback(requestId: any, port: any, result: any): void {
    if (requestId) {
      port.postMessage({command: 'callback', requestId: requestId, result: result});
    }
  }

  _initExtensions(): void {
    this._registerAutosubscriptionHandler(
        Extensions.extensionAPI.Events.ResourceAdded, Workspace.Workspace.WorkspaceImpl.instance(),
        Workspace.Workspace.Events.UISourceCodeAdded, this._notifyResourceAdded);
    this._registerAutosubscriptionTargetManagerHandler(
        Extensions.extensionAPI.Events.NetworkRequestFinished, SDK.NetworkManager.NetworkManager,
        SDK.NetworkManager.Events.RequestFinished, this._notifyRequestFinished);

    function onElementsSubscriptionStarted(this: ExtensionServer): void {
      UI.Context.Context.instance().addFlavorChangeListener(
          SDK.DOMModel.DOMNode, this._notifyElementsSelectionChanged, this);
    }

    function onElementsSubscriptionStopped(this: ExtensionServer): void {
      UI.Context.Context.instance().removeFlavorChangeListener(
          SDK.DOMModel.DOMNode, this._notifyElementsSelectionChanged, this);
    }

    this._registerSubscriptionHandler(
        Extensions.extensionAPI.Events.PanelObjectSelected + 'elements', onElementsSubscriptionStarted.bind(this),
        onElementsSubscriptionStopped.bind(this));
    this._registerResourceContentCommittedHandler(this._notifyUISourceCodeContentCommitted);

    SDK.TargetManager.TargetManager.instance().addEventListener(
        SDK.TargetManager.Events.InspectedURLChanged, this._inspectedURLChanged, this);
  }

  _notifyResourceAdded(event: any): void {
    const uiSourceCode = (event.data as Workspace.UISourceCode.UISourceCode);
    this._postNotification(Extensions.extensionAPI.Events.ResourceAdded, this._makeResource(uiSourceCode));
  }

  _notifyUISourceCodeContentCommitted(event: any): void {
    const uiSourceCode = (event.data.uiSourceCode as Workspace.UISourceCode.UISourceCode);
    const content = (event.data.content as string);
    this._postNotification(
        Extensions.extensionAPI.Events.ResourceContentCommitted, this._makeResource(uiSourceCode), content);
  }

  async _notifyRequestFinished(event: any): Promise<void> {
    const request = (event.data as SDK.NetworkRequest.NetworkRequest);
    const entry = await HAR.Log.Entry.build(request);
    this._postNotification(Extensions.extensionAPI.Events.NetworkRequestFinished, this._requestId(request), entry);
  }

  _notifyElementsSelectionChanged(): void {
    this._postNotification(Extensions.extensionAPI.Events.PanelObjectSelected + 'elements');
  }

  sourceSelectionChanged(url: string, range: TextUtils.TextRange.TextRange): void {
    this._postNotification(Extensions.extensionAPI.Events.PanelObjectSelected + 'sources', {
      startLine: range.startLine,
      startColumn: range.startColumn,
      endLine: range.endLine,
      endColumn: range.endColumn,
      url: url,
    });
  }

  _setInspectedTabId(event: Common.EventTarget.EventTargetEvent): void {
    this._inspectedTabId = (event.data as string);
  }

  _addExtension(extensionInfo: Host.InspectorFrontendHostAPI.ExtensionDescriptor): boolean|undefined {
    const startPage = extensionInfo.startPage;

    const inspectedURL = SDK.TargetManager.TargetManager.instance().mainTarget().inspectedURL();
    if (inspectedURL !== '' && !this._canInspectURL(inspectedURL)) {
      this._disableExtensions();
    }
    if (!this._extensionsEnabled) {
      return;
    }
    try {
      const startPageURL = new URL((startPage as string));
      const extensionOrigin = startPageURL.origin;
      if (!this._registeredExtensions.get(extensionOrigin)) {
        // See ExtensionAPI.js for details.
        const injectedAPI = self.buildExtensionAPIInjectedScript(
            (extensionInfo as {
              startPage: string,
              name: string,
              exposeExperimentalAPIs: boolean,
            }),
            this._inspectedTabId, ThemeSupport.ThemeSupport.instance().themeName(),
            UI.ShortcutRegistry.ShortcutRegistry.instance().globalShortcutKeys(),
            ExtensionServer.instance()['_extensionAPITestHook']);
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.setInjectedScriptForOrigin(
            extensionOrigin, injectedAPI);
        const name = extensionInfo.name || `Extension ${extensionOrigin}`;
        this._registeredExtensions.set(extensionOrigin, {name});
      }
      const iframe = createElement('iframe');
      iframe.src = startPage;
      iframe.dataset.devtoolsExtension = extensionInfo.name;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);  // Only for main window.
    } catch (e) {
      console.error('Failed to initialize extension ' + startPage + ':' + e);
      return false;
    }
    return true;
  }

  _registerExtension(origin: any, port: any): void {
    if (!this._registeredExtensions.has(origin)) {
      if (origin !== window.location.origin) {  // Just ignore inspector frames.
        console.error('Ignoring unauthorized client request from ' + origin);
      }
      return;
    }
    port[extensionOriginSymbol] = origin;
    port.addEventListener('message', this._onmessage.bind(this), false);
    port.start();
  }

  _onWindowMessage(event: any): void {
    if (event.data === 'registerExtension') {
      this._registerExtension(event.origin, event.ports[0]);
    }
  }

  async _onmessage(event: any): Promise<void> {
    const message = event.data;
    let result;

    if (!(message.command in this._handlers)) {
      result = this._status.E_NOTSUPPORTED(message.command);
    } else if (!this._extensionsEnabled) {
      result = this._status.E_FAILED('Permission denied');
    } else {
      result = await this._handlers[message.command](message, event.target);
    }

    if (result && message.requestId) {
      this._dispatchCallback(message.requestId, event.target, result);
    }
  }

  _registerHandler(command: any, callback: any): void {
    console.assert(command);
    this._handlers[command] = callback;
  }

  _registerSubscriptionHandler(eventTopic: any, onSubscribeFirst: any, onUnsubscribeLast: any): void {
    this._subscriptionStartHandlers[eventTopic] = onSubscribeFirst;
    this._subscriptionStopHandlers[eventTopic] = onUnsubscribeLast;
  }

  _registerAutosubscriptionHandler(
      eventTopic: string, eventTarget: Object, frontendEventType: symbol,
      handler: (arg0: Common.EventTarget.EventTargetEvent) => any): void {
    this._registerSubscriptionHandler(
        eventTopic, eventTarget.addEventListener.bind(eventTarget, frontendEventType, handler, this),
        eventTarget.removeEventListener.bind(eventTarget, frontendEventType, handler, this));
  }

  _registerAutosubscriptionTargetManagerHandler(
      eventTopic: string, modelClass: Function, frontendEventType: symbol,
      handler: (arg0: Common.EventTarget.EventTargetEvent) => any): void {
    this._registerSubscriptionHandler(
        eventTopic,
        SDK.TargetManager.TargetManager.instance().addModelListener.bind(
            SDK.TargetManager.TargetManager.instance(), modelClass, frontendEventType, handler, this),
        SDK.TargetManager.TargetManager.instance().removeModelListener.bind(
            SDK.TargetManager.TargetManager.instance(), modelClass, frontendEventType, handler, this));
  }

  _registerResourceContentCommittedHandler(handler: any): void {
    function addFirstEventListener(this: ExtensionServer): void {
      Workspace.Workspace.WorkspaceImpl.instance().addEventListener(
          Workspace.Workspace.Events.WorkingCopyCommittedByUser, handler, this);
      Workspace.Workspace.WorkspaceImpl.instance().setHasResourceContentTrackingExtensions(true);
    }

    function removeLastEventListener(this: ExtensionServer): void {
      Workspace.Workspace.WorkspaceImpl.instance().setHasResourceContentTrackingExtensions(false);
      Workspace.Workspace.WorkspaceImpl.instance().removeEventListener(
          Workspace.Workspace.Events.WorkingCopyCommittedByUser, handler, this);
    }

    this._registerSubscriptionHandler(
        Extensions.extensionAPI.Events.ResourceContentCommitted, addFirstEventListener.bind(this),
        removeLastEventListener.bind(this));
  }

  _expandResourcePath(extensionPath: any, resourcePath: any): string|undefined {
    if (!resourcePath) {
      return;
    }
    return extensionPath + this._normalizePath(resourcePath);
  }

  _normalizePath(path: any): string {
    const source = path.split('/');
    const result = [];

    for (let i = 0; i < source.length; ++i) {
      if (source[i] === '.') {
        continue;
      }
      // Ignore empty path components resulting from //, as well as a leading and traling slashes.
      if (source[i] === '') {
        continue;
      }
      if (source[i] === '..') {
        result.pop();
      } else {
        result.push(source[i]);
      }
    }
    return '/' + result.join('/');
  }

  evaluate(
      expression: string, exposeCommandLineAPI: boolean, returnByValue: boolean, options: Object|null,
      securityOrigin: string,
      callback: (arg0: string|null, arg1: SDK.RemoteObject.RemoteObject|null, arg2: boolean) => any): Record|undefined {
    let context;

    function resolveURLToFrame(url: string): boolean {
      let found;
      function hasMatchingURL(frame: any): any {
        found = (frame.url === url) ? frame : null;
        return found;
      }
      SDK.ResourceTreeModel.ResourceTreeModel.frames().some(hasMatchingURL);
      return found;
    }

    options = options || {};
    let frame;
    if (options.frameURL) {
      frame = resolveURLToFrame(options.frameURL);
    } else {
      const target = SDK.TargetManager.TargetManager.instance().mainTarget();
      const resourceTreeModel = target && target.model(SDK.ResourceTreeModel.ResourceTreeModel);
      frame = resourceTreeModel && resourceTreeModel.mainFrame;
    }
    if (!frame) {
      if (options.frameURL) {
        console.warn('evaluate: there is no frame with URL ' + options.frameURL);
      } else {
        console.warn('evaluate: the main frame is not yet available');
      }
      return this._status.E_NOTFOUND(options.frameURL || '<top>');
    }
    // We shouldn't get here if the top frame can't be inspected by an extension, but
    // let's double check for subframes.
    if (!this._canInspectURL(frame.url)) {
      return this._status.E_FAILED('Permission denied');
    }

    let contextSecurityOrigin;
    if (options.useContentScriptContext) {
      contextSecurityOrigin = securityOrigin;
    } else if (options.scriptExecutionContext) {
      contextSecurityOrigin = options.scriptExecutionContext;
    }

    const runtimeModel = frame.resourceTreeModel().target().model(SDK.RuntimeModel.RuntimeModel);
    const executionContexts = runtimeModel ? runtimeModel.executionContexts() : [];
    if (contextSecurityOrigin) {
      for (let i = 0; i < executionContexts.length; ++i) {
        const executionContext = executionContexts[i];
        if (executionContext.frameId === frame.id && executionContext.origin === contextSecurityOrigin &&
            !executionContext.isDefault) {
          context = executionContext;
        }
      }
      if (!context) {
        console.warn('The JavaScript context ' + contextSecurityOrigin + ' was not found in the frame ' + frame.url);
        return this._status.E_NOTFOUND(contextSecurityOrigin);
      }
    } else {
      for (let i = 0; i < executionContexts.length; ++i) {
        const executionContext = executionContexts[i];
        if (executionContext.frameId === frame.id && executionContext.isDefault) {
          context = executionContext;
        }
      }
      if (!context) {
        return this._status.E_FAILED(frame.url + ' has no execution context');
      }
    }
    if (!this._canInspectURL(context.origin)) {
      return this._status.E_FAILED('Permission denied');
    }

    context
        .evaluate(
            {
              expression: expression,
              objectGroup: 'extension',
              includeCommandLineAPI: exposeCommandLineAPI,
              silent: true,
              returnByValue: returnByValue,
              generatePreview: false,
            },
            /* userGesture */ false, /* awaitPromise */ false)
        .then(onEvaluate);

    function onEvaluate(result: SDK.RuntimeModel.EvaluationResult): void {
      if (result.error) {
        callback(result.error, null, false);
        return;
      }
      callback(null, result.object || null, Boolean(result.exceptionDetails));
    }
  }

  _canInspectURL(url: string): boolean {
    let parsedURL;
    // This is only to work around invalid URLs we're occasionally getting from some tests.
    // TODO(caseq): make sure tests supply valid URLs or we specifically handle invalid ones.
    try {
      parsedURL = new URL(url);
    } catch (exception) {
      return false;
    }
    if (kAllowedOrigins.includes(parsedURL.origin)) {
      return true;
    }
    if (parsedURL.protocol === 'chrome:' || parsedURL.protocol === 'devtools:') {
      return false;
    }
    if (parsedURL.protocol.startsWith('http') && parsedURL.hostname === 'chrome.google.com' &&
        parsedURL.pathname.startsWith('/webstore')) {
      return false;
    }
    return true;
  }

  _disableExtensions(): void {
    this._extensionsEnabled = false;
  }
}

// TODO(crbug.com/1167717): Make this a const enum again
// eslint-disable-next-line rulesdir/const_enum
export enum Events {
  SidebarPaneAdded = 'SidebarPaneAdded',
  TraceProviderAdded = 'TraceProviderAdded',
}


class ExtensionServerPanelView extends UI.View.SimpleView {
  _name: string;
  _panel: UI.Panel.Panel;

  constructor(name: string, title: string, panel: UI.Panel.Panel) {
    super(title);
    this._name = name;
    this._panel = panel;
  }

  viewId(): string {
    return this._name;
  }

  widget(): Promise<UI.Widget.Widget> {
    return Promise.resolve(this._panel) as Promise<UI.Widget.Widget>;
  }
}

export class ExtensionStatus {
  OK: (...args: any[]) => Record;
  E_EXISTS: (...args: any[]) => Record;
  E_BADARG: (...args: any[]) => Record;
  E_BADARGTYPE: (...args: any[]) => Record;
  E_NOTFOUND: (...args: any[]) => Record;
  E_NOTSUPPORTED: (...args: any[]) => Record;
  E_PROTOCOLERROR: (...args: any[]) => Record;
  E_FAILED: (...args: any[]) => Record;

  constructor() {
    function makeStatus(code: string, description: string): Record {
      const details = Array.prototype.slice.call(arguments, 2);
      const status = {code: code, description: description, details: details};
      if (code !== 'OK') {
        status.isError = true;
        console.error('Extension server error: ' + Platform.StringUtilities.vsprintf(description, details));
      }
      return status;
    }

    this.OK = makeStatus.bind(null, 'OK', 'OK');
    this.E_EXISTS = makeStatus.bind(null, 'E_EXISTS', 'Object already exists: %s');
    this.E_BADARG = makeStatus.bind(null, 'E_BADARG', 'Invalid argument %s: %s');
    this.E_BADARGTYPE = makeStatus.bind(null, 'E_BADARGTYPE', 'Invalid type for argument %s: got %s, expected %s');
    this.E_NOTFOUND = makeStatus.bind(null, 'E_NOTFOUND', 'Object not found: %s');
    this.E_NOTSUPPORTED = makeStatus.bind(null, 'E_NOTSUPPORTED', 'Object does not support requested operation: %s');
    this.E_PROTOCOLERROR = makeStatus.bind(null, 'E_PROTOCOLERROR', 'Inspector protocol error: %s');
    this.E_FAILED = makeStatus.bind(null, 'E_FAILED', 'Operation failed: %s');
  }
}
export interface Record {
  code: string;
  description: string;
  details: any[];
}
