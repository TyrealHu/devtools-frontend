// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../../core/common/common.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Protocol from '../../generated/protocol.js';

import {NetworkLog} from './NetworkLog.js';

const modelToEventListeners = new WeakMap<SDK.LogModel.LogModel, Common.EventTarget.EventDescriptor[]>();

let instance: LogManager|null = null;

export class LogManager implements SDK.TargetManager.SDKModelObserver<SDK.LogModel.LogModel> {
  private constructor() {
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.LogModel.LogModel, this);
  }

  static instance({forceNew}: {forceNew: boolean} = {forceNew: false}): LogManager {
    if (!instance || forceNew) {
      instance = new LogManager();
    }

    return instance;
  }

  modelAdded(logModel: SDK.LogModel.LogModel): void {
    const eventListeners = [];
    eventListeners.push(logModel.addEventListener(SDK.LogModel.Events.EntryAdded, this.logEntryAdded, this));
    modelToEventListeners.set(logModel, eventListeners);
  }

  modelRemoved(logModel: SDK.LogModel.LogModel): void {
    const eventListeners = modelToEventListeners.get(logModel);
    if (eventListeners) {
      Common.EventTarget.EventTarget.removeEventListeners(eventListeners);
    }
  }

  private logEntryAdded(event: Common.EventTarget.EventTargetEvent): void {
    const data = event.data as {
      logModel: SDK.LogModel.LogModel,
      entry: Protocol.Log.LogEntry,
    };
    const target = data.logModel.target();

    const consoleMessage = new SDK.ConsoleModel.ConsoleMessage(
        target.model(SDK.RuntimeModel.RuntimeModel), data.entry.source, data.entry.level, data.entry.text, undefined,
        data.entry.url, data.entry.lineNumber, undefined, [data.entry.text, ...(data.entry.args || [])],
        data.entry.stackTrace, data.entry.timestamp, undefined, undefined, data.entry.workerId);

    if (data.entry.networkRequestId) {
      NetworkLog.instance().associateConsoleMessageWithRequest(consoleMessage, data.entry.networkRequestId);
    }

    if (consoleMessage.source === Protocol.Log.LogEntrySource.Worker) {
      const workerId = consoleMessage.workerId || '';
      // We have a copy of worker messages reported through the page, so that
      // user can see messages from the worker which has been already destroyed.
      // When opening DevTools, give us some time to connect to the worker and
      // not report the message twice if the worker is still alive.
      if (SDK.TargetManager.TargetManager.instance().targetById(workerId)) {
        return;
      }
      setTimeout(() => {
        if (!SDK.TargetManager.TargetManager.instance().targetById(workerId)) {
          SDK.ConsoleModel.ConsoleModel.instance().addMessage(consoleMessage);
        }
      }, 1000);
    } else {
      SDK.ConsoleModel.ConsoleModel.instance().addMessage(consoleMessage);
    }
  }
}
