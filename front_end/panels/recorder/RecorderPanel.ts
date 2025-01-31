// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// import * as i18n from '../../core/i18n/i18n.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Recorder from '../../models/recorder/recorder.js';
import * as UI from '../../ui/legacy/legacy.js';

import * as Components from './components/components.js';

// const UIStrings = {};
// const str_ = i18n.i18n.registerUIStrings('panels/recorder/RecorderPanel.ts', UIStrings);
// const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
let recorderPanelInstance: RecorderPanel;

export class RecorderPanel extends UI.Panel.Panel {
  private recording: Recorder.Steps.UserFlow|null;

  constructor() {
    super('recorder');
    this.registerRequiredCSS('panels/recorder/recorderPanel.css', {enableLegacyPatching: false});

    const mainContainer = new UI.Widget.VBox();
    mainContainer.show(this.element);

    const target = SDK.TargetManager.TargetManager.instance().mainTarget() as SDK.Target.Target;

    const recorderModel = target.model(Recorder.RecorderModel.RecorderModel);
    if (!recorderModel) {
      throw new Error('Could not find recorder model.');
    }

    recorderModel.getAvailableRecordings();

    this.recording = {
      title: 'Recording 1',
      description: 'This is a description',
      sections: [],
    } as Recorder.Steps.UserFlow;

    const recordingView = new Components.RecordingView.RecordingView();
    recordingView.style.flex = '1';
    recordingView.addEventListener('recordingtoggled', async (e: Event) => {
      const event = e as Components.RecordingView.RecordingToggledEvent;
      const currentSession = await recorderModel.toggleRecording();

      recordingView.data = {
        recording: (currentSession ? currentSession.getUserFlow() : this.recording) as Recorder.Steps.UserFlow,
        isRecording: event.data,
      };

      if (currentSession) {
        currentSession.addEventListener('recording-updated', async ({data}: {data: Recorder.Steps.UserFlow}) => {
          this.recording = data;
          recordingView.data = {
            recording: data,
            isRecording: event.data,
          };
          recordingView.scrollToBottom();
        });
      }
    });

    recordingView.data = {
      recording: this.recording,
      isRecording: false,
    };

    mainContainer.element.appendChild(recordingView as Node);
  }

  static instance(opts: {
    forceNew: boolean|null,
  } = {forceNew: null}): RecorderPanel {
    const {forceNew} = opts;
    if (!recorderPanelInstance || forceNew) {
      recorderPanelInstance = new RecorderPanel();
    }

    return recorderPanelInstance;
  }
}
