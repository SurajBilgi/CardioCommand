/**
 * VoiceAgent — Browser-based voice call state machine
 * =====================================================
 * Uses Web Speech API for TTS + STT entirely in the browser.
 * No external API keys required for browser demo mode.
 *
 * States:
 *   idle → ringing → connected → greeting → asking → listening
 *   → processing → closing → analyzing → complete | error
 *
 * Usage:
 *   const agent = new VoiceAgent({ script, patient, callbacks })
 *   agent.start()
 *   agent.skip()       // skip current question
 *   agent.endCall()    // terminate early
 */

export const CALL_STATES = {
  IDLE:        'idle',
  RINGING:     'ringing',
  CONNECTED:   'connected',
  GREETING:    'greeting',
  ASKING:      'asking',
  LISTENING:   'listening',
  PROCESSING:  'processing',
  CLOSING:     'closing',
  ANALYZING:   'analyzing',
  COMPLETE:    'complete',
  ERROR:       'error',
}

const STATE_LABELS = {
  idle:       'Ready',
  ringing:    'Calling patient…',
  connected:  'Connected',
  greeting:   'Speaking…',
  asking:     'Speaking…',
  listening:  'Listening…',
  processing: 'Processing…',
  closing:    'Speaking…',
  analyzing:  'Analysing call…',
  complete:   'Call complete',
  error:      'Error',
}

export function getStateLabel(state) {
  return STATE_LABELS[state] || state
}

export class VoiceAgent {
  /**
   * @param {object} opts
   * @param {object} opts.script        — VOICE_SCRIPT from backend /voice/script
   * @param {object} opts.patient       — patient data object
   * @param {function} opts.onState     — (state, meta?) => void
   * @param {function} opts.onTranscript — ({ speaker, text, interim, question_id }) => void
   * @param {function} opts.onComplete  — (transcript[]) => void  (triggers analysis)
   * @param {function} opts.onError     — (message) => void
   */
  constructor({ script, patient, onState, onTranscript, onComplete, onError }) {
    this.script = script
    this.patient = patient
    this.onState = onState || (() => {})
    this.onTranscript = onTranscript || (() => {})
    this.onComplete = onComplete || (() => {})
    this.onError = onError || (() => {})

    this._state = CALL_STATES.IDLE
    this._questionIndex = 0
    this._transcript = []          // full call transcript
    this._synth = window.speechSynthesis
    this._recognition = null
    this._voices = []
    this._stopped = false
    this._currentUtterance = null
    this._silenceTimer = null

    // Pre-load voices (async in Chrome)
    this._loadVoices()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async start() {
    this._stopped = false
    this._questionIndex = 0
    this._transcript = []

    this._setState(CALL_STATES.RINGING)
    await this._delay(2000)   // simulated ring
    if (this._stopped) return

    this._setState(CALL_STATES.CONNECTED)
    await this._delay(800)
    if (this._stopped) return

    this._setState(CALL_STATES.GREETING)
    const greetingText = this._interpolate(this.script.greeting || 'Hello.')
    await this._speak(greetingText, 'agent')
    if (this._stopped) return

    await this._delay(500)
    this._askNextQuestion()
  }

  skip() {
    // Skip current STT listening — move to next question
    this._stopListening()
    this._addToTranscript({ speaker: 'patient', text: '[skipped]', question_id: this._currentQuestionId() })
    this._questionIndex++
    clearTimeout(this._silenceTimer)
    this._askNextQuestion()
  }

  endCall() {
    this._stopped = true
    this._stopListening()
    this._synth.cancel()
    clearTimeout(this._silenceTimer)
    this._finalise()
  }

  get transcript() {
    return this._transcript
  }

  get state() {
    return this._state
  }

  // ── Private: state machine ─────────────────────────────────────────────────

  async _askNextQuestion() {
    if (this._stopped) return

    const questions = this.script.questions || []

    if (this._questionIndex >= questions.length) {
      await this._close()
      return
    }

    const q = questions[this._questionIndex]
    this._setState(CALL_STATES.ASKING, { question: q, index: this._questionIndex, total: questions.length })
    await this._speak(q.ask, 'agent', q.id)
    if (this._stopped) return

    await this._listen(q)
  }

  async _listen(question) {
    if (this._stopped) return

    this._setState(CALL_STATES.LISTENING, { question })

    try {
      const response = await this._startSTT(question.id)
      if (this._stopped) return

      this._addToTranscript({ speaker: 'patient', text: response, question_id: question.id })

      // Speak follow-up if it isn't a placeholder
      const followUp = question.follow_up || ''
      if (followUp && !followUp.includes('[PLACEHOLDER')) {
        this._setState(CALL_STATES.PROCESSING)
        await this._speak(this._interpolate(followUp), 'agent')
      }
    } catch {
      // STT failed or timed out — record silence and move on
      this._addToTranscript({ speaker: 'patient', text: '[No response detected]', question_id: question.id })
    }

    if (this._stopped) return
    this._questionIndex++
    await this._delay(400)
    this._askNextQuestion()
  }

  async _close() {
    if (this._stopped) return
    this._setState(CALL_STATES.CLOSING)

    let closingText = this.script.closing || 'Thank you. Goodbye.'
    if (closingText.includes('[PLACEHOLDER')) {
      closingText = `Thank you so much for your time today, ${this.patient.name}. I've captured everything you shared and will pass it directly to your care team right away. Take care and have a wonderful day!`
    }
    await this._speak(this._interpolate(closingText), 'agent')
    this._finalise()
  }

  _finalise() {
    this._setState(CALL_STATES.ANALYZING)
    this.onComplete(this._transcript)
  }

  // ── Private: TTS ───────────────────────────────────────────────────────────

  _speak(text, speaker = 'agent', questionId = null) {
    return new Promise((resolve) => {
      if (this._stopped) { resolve(); return }

      // Cancel any ongoing speech
      this._synth.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      const ttsCfg = this.script.tts || {}

      utterance.voice = this._pickVoice(ttsCfg.preferred_voice)
      utterance.rate   = ttsCfg.rate   ?? 0.88
      utterance.pitch  = ttsCfg.pitch  ?? 1.05
      utterance.volume = ttsCfg.volume ?? 1.0

      utterance.onend = () => {
        if (speaker === 'agent') {
          this._addToTranscript({ speaker: 'agent', text, question_id: questionId })
        }
        resolve()
      }
      utterance.onerror = () => resolve()

      this._currentUtterance = utterance
      this._synth.speak(utterance)
    })
  }

  _pickVoice(preferredName) {
    if (!this._voices.length) return null

    // Try exact name match
    if (preferredName) {
      const exact = this._voices.find(v => v.name === preferredName)
      if (exact) return exact
    }

    // Try any English female voice
    const female = this._voices.find(v =>
      v.lang.startsWith('en') && /female|woman|girl|samantha|zira|victoria|karen|moira|fiona|joanna|kendra|salli|ivy|amy|emma/i.test(v.name)
    )
    if (female) return female

    // Fallback: any English voice
    return this._voices.find(v => v.lang.startsWith('en')) || this._voices[0]
  }

  _loadVoices() {
    const load = () => { this._voices = this._synth.getVoices() }
    load()
    this._synth.addEventListener('voiceschanged', load)
  }

  // ── Private: STT ───────────────────────────────────────────────────────────

  _startSTT(questionId) {
    return new Promise((resolve, reject) => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        this.onError('Speech recognition not supported in this browser. Please use Chrome or Edge.')
        reject(new Error('SpeechRecognition not supported'))
        return
      }

      const recognition = new SpeechRecognition()
      const sttCfg = this.script.stt || {}

      recognition.lang = sttCfg.language || 'en-US'
      recognition.interimResults = true
      recognition.continuous = false
      recognition.maxAlternatives = 1

      this._recognition = recognition

      let finalText = ''
      let interimText = ''
      const maxMs = (sttCfg.max_listen_sec || 20) * 1000
      const silenceMs = (sttCfg.silence_gap_sec || 2.5) * 1000

      // Hard timeout
      const hardStop = setTimeout(() => {
        recognition.stop()
        resolve(finalText || interimText || '[No response]')
      }, maxMs)

      // Silence detection
      const resetSilence = () => {
        clearTimeout(this._silenceTimer)
        this._silenceTimer = setTimeout(() => {
          recognition.stop()
        }, silenceMs)
      }

      recognition.onstart = () => resetSilence()

      recognition.onresult = (event) => {
        resetSilence()
        let interim = ''
        let final = ''
        for (const result of event.results) {
          if (result.isFinal) final += result[0].transcript
          else interim += result[0].transcript
        }
        finalText = final || finalText
        interimText = interim

        // Show live interim to UI
        this.onTranscript({
          speaker: 'patient',
          text: final || interim,
          interim: !final,
          question_id: questionId,
        })
      }

      recognition.onend = () => {
        clearTimeout(hardStop)
        clearTimeout(this._silenceTimer)
        resolve(finalText || interimText || '[No response]')
      }

      recognition.onerror = (e) => {
        clearTimeout(hardStop)
        clearTimeout(this._silenceTimer)
        if (e.error === 'no-speech') resolve('[No response]')
        else reject(new Error(e.error))
      }

      recognition.start()
    })
  }

  _stopListening() {
    if (this._recognition) {
      try { this._recognition.stop() } catch {}
      this._recognition = null
    }
    this._synth.cancel()
  }

  // ── Private: helpers ───────────────────────────────────────────────────────

  _setState(state, meta = {}) {
    this._state = state
    this.onState(state, meta)
  }

  _addToTranscript(entry) {
    // Deduplicate consecutive interim entries for the same speaker
    const last = this._transcript[this._transcript.length - 1]
    if (last && last.speaker === entry.speaker && last.question_id === entry.question_id && entry.interim) {
      this._transcript[this._transcript.length - 1] = entry
    } else {
      this._transcript.push({ ...entry, timestamp: new Date().toISOString() })
    }
  }

  _currentQuestionId() {
    const q = (this.script.questions || [])[this._questionIndex]
    return q?.id || null
  }

  _interpolate(text) {
    const s = this.script
    const p = this.patient
    return (text || '')
      .replace(/\{patient_name\}/g,  p.name || 'there')
      .replace(/\{agent_name\}/g,    s.agent_name || 'Cora')
      .replace(/\{hospital_name\}/g, s.hospital_name || 'your care team')
      .replace(/\{doctor_name\}/g,   s.doctor_name || 'your doctor')
      .replace(/\{nurse_line\}/g,    s.nurse_line || 'your care team')
      .replace(/\{surgery_type\}/g,  p.surgery_type || 'your procedure')
      .replace(/\{days_post_op\}/g,  String(p.days_post_op || ''))
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
