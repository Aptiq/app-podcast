declare module 'elevenlabs-node' {
  export class ElevenLabs {
    constructor(apiKey: string);
    
    getVoices(): Promise<Voice[]>;
    
    textToSpeech(
      voiceId: string,
      text: string,
      voiceSettings?: VoiceSettings
    ): Promise<ArrayBuffer>;
  }
  
  export interface Voice {
    voice_id: string;
    name: string;
    category?: string;
    description?: string;
    preview_url?: string;
  }
  
  export interface VoiceSettings {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  }
} 