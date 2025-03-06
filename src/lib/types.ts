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