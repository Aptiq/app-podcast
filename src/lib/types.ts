// Types pour le générateur de podcasts

// Type pour les sources de contenu
export type ContentSource = {
  type: 'text' | 'url';
  content: string;
};

// Type pour les langues supportées
export type SupportedLanguage = 
  | 'fr' // Français
  | 'en' // Anglais
  | 'es' // Espagnol
  | 'de' // Allemand
  | 'it' // Italien
  | 'pt' // Portugais
  | 'nl' // Néerlandais
  | 'ru' // Russe
  | 'zh' // Chinois
  | 'ja'; // Japonais

// Type pour les voix OpenAI
export type OpenAIVoice = 
  | 'alloy' // Voix neutre
  | 'echo' // Voix masculine grave
  | 'fable' // Voix féminine douce
  | 'onyx' // Voix masculine profonde
  | 'nova' // Voix féminine énergique
  | 'shimmer'; // Voix féminine claire

// Type pour les voix ElevenLabs
export type ElevenLabsVoice = {
  id: string;
  name: string;
  description: string;
};

// Voix ElevenLabs prédéfinies
export const ELEVENLABS_VOICES: ElevenLabsVoice[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Voix féminine calme et posée" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Voix féminine énergique" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Voix féminine douce" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Voix masculine profonde" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Voix féminine jeune" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Voix masculine naturelle" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "Voix masculine grave" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Voix masculine posée" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "Voix masculine jeune" }
];

// Type pour les paramètres de génération
export type GenerationParams = {
  // Paramètres basiques
  length: number; // Longueur du contenu (500-5000 mots)
  style: 'conversational' | 'debate' | 'interview' | 'educational';
  firstSpeaker: string; // Rôle du premier intervenant
  secondSpeaker: string; // Rôle du second intervenant
  podcastName: string; // Nom du podcast
  tagline: string; // Tagline du podcast
  language: SupportedLanguage; // Langue du podcast
  
  // Paramètres avancés
  ttsModel: 'openai' | 'elevenlabs' | 'edge';
  creativity: number; // Niveau de créativité (0-1)
  
  // Voix des intervenants (OpenAI)
  firstSpeakerVoice: OpenAIVoice; // Voix du premier intervenant
  secondSpeakerVoice: OpenAIVoice; // Voix du second intervenant
  
  // Voix des intervenants (ElevenLabs)
  firstSpeakerElevenLabsVoiceId: string; // ID de la voix ElevenLabs du premier intervenant
  secondSpeakerElevenLabsVoiceId: string; // ID de la voix ElevenLabs du second intervenant
};

// Type pour la configuration des API
export interface ApiConfig {
  openai?: string;
  gemini?: string;
  elevenlabs?: string;
}

// Type pour la réponse de l'API de génération
export type GenerationResponse = {
  transcript: string;
  audioUrl: string;
  duration: number;
};

// Type pour les erreurs de l'API
export type ApiError = {
  message: string;
  code?: string;
}; 