import { NextRequest, NextResponse } from 'next/server';
import { ContentSource, GenerationParams, SupportedLanguage, ApiConfig } from '@/lib/types';
import OpenAI from 'openai';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import path from 'path';
import { mkdir } from 'fs/promises';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

// Fonction pour obtenir un exemple de transcript selon la langue
function getTranscriptExample(language: SupportedLanguage, params: GenerationParams): string {
  // Exemples de transcripts dans différentes langues
  const transcripts: Record<SupportedLanguage, string> = {
    fr: `<Person1>Bienvenue à ${params.podcastName}! ${params.tagline}</Person1>
<Person2>Aujourd'hui, nous allons discuter de ce contenu fascinant.</Person2>
<Person1>Exactement! Commençons par analyser les points principaux.</Person1>
<Person2>D'accord, le premier point important est...</Person2>`,
    
    en: `<Person1>Welcome to ${params.podcastName}! ${params.tagline}</Person1>
<Person2>Today, we're going to discuss this fascinating content.</Person2>
<Person1>Exactly! Let's start by analyzing the main points.</Person1>
<Person2>Alright, the first important point is...</Person2>`,
    
    es: `<Person1>¡Bienvenidos a ${params.podcastName}! ${params.tagline}</Person1>
<Person2>Hoy vamos a discutir este contenido fascinante.</Person2>
<Person1>¡Exactamente! Empecemos analizando los puntos principales.</Person1>
<Person2>De acuerdo, el primer punto importante es...</Person2>`,
    
    de: `<Person1>Willkommen bei ${params.podcastName}! ${params.tagline}</Person1>
<Person2>Heute werden wir über diesen faszinierenden Inhalt diskutieren.</Person2>
<Person1>Genau! Beginnen wir mit der Analyse der Hauptpunkte.</Person1>
<Person2>In Ordnung, der erste wichtige Punkt ist...</Person2>`,
    
    it: `<Person1>Benvenuti a ${params.podcastName}! ${params.tagline}</Person1>
<Person2>Oggi discuteremo di questo affascinante contenuto.</Person2>
<Person1>Esattamente! Iniziamo analizzando i punti principali.</Person1>
<Person2>D'accordo, il primo punto importante è...</Person2>`,
    
    pt: `<Person1>Bem-vindos ao ${params.podcastName}! ${params.tagline}</Person1>
<Person2>Hoje vamos discutir este conteúdo fascinante.</Person2>
<Person1>Exatamente! Vamos começar analisando os pontos principais.</Person1>
<Person2>Certo, o primeiro ponto importante é...</Person2>`,
    
    nl: `<Person1>Welkom bij ${params.podcastName}! ${params.tagline}</Person1>
<Person2>Vandaag gaan we deze fascinerende inhoud bespreken.</Person2>
<Person1>Precies! Laten we beginnen met het analyseren van de belangrijkste punten.</Person1>
<Person2>Oké, het eerste belangrijke punt is...</Person2>`,
    
    ru: `<Person1>Добро пожаловать в ${params.podcastName}! ${params.tagline}</Person1>
<Person2>Сегодня мы обсудим этот увлекательный контент.</Person2>
<Person1>Именно! Давайте начнем с анализа основных моментов.</Person1>
<Person2>Хорошо, первый важный момент...</Person2>`,
    
    zh: `<Person1>欢迎收听 ${params.podcastName}！${params.tagline}</Person1>
<Person2>今天我们将讨论这个引人入胜的内容。</Person2>
<Person1>没错！让我们从分析主要观点开始。</Person1>
<Person2>好的，第一个重要观点是...</Person2>`,
    
    ja: `<Person1>${params.podcastName}へようこそ！${params.tagline}</Person1>
<Person2>今日は、この魅力的なコンテンツについて議論します。</Person2>
<Person1>その通り！主なポイントを分析することから始めましょう。</Person1>
<Person2>わかりました、最初の重要なポイントは...</Person2>`
  };
  
  return transcripts[language] || transcripts.en;
}

// Fonction pour générer une transcription avec OpenAI
async function generateTranscript(source: ContentSource, params: GenerationParams, apiConfig: ApiConfig): Promise<string> {
  try {
    console.log("Début de la génération de transcription...");
    console.log("Source:", source.type, source.content.substring(0, 50) + "...");
    console.log("Paramètres:", JSON.stringify(params, null, 2));
    console.log("Langue sélectionnée:", params.language);
    
    // Vérifier si la clé API OpenAI est configurée
    const openaiApiKey = apiConfig.openai;
    if (!openaiApiKey) {
      console.warn("Clé API OpenAI non configurée, utilisation d'un exemple de transcript");
      return getTranscriptExample(params.language, params);
    }
    
    console.log("Clé API OpenAI configurée, initialisation du client OpenAI...");
    
    // Initialiser le client OpenAI
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });
    
    // Préparer le prompt pour la génération de transcription
    // Adapter le prompt en fonction de la langue
    let systemPrompt = "";
    let userPrompt = "";
    
    // Définir les prompts en fonction de la langue
    switch (params.language) {
      case 'fr':
        systemPrompt = "Tu es un expert en création de podcasts. Tu dois générer un script de podcast naturel et engageant en français.";
        userPrompt = `
        Génère un script de podcast entre deux personnes sur le sujet suivant:
        
        ${source.content}
        
        Format du script:
        <Person1>Texte de la première personne</Person1>
        <Person2>Texte de la deuxième personne</Person2>
        
        Détails du podcast:
        - Nom du podcast: ${params.podcastName}
        - Tagline: ${params.tagline}
        - Premier intervenant: ${params.firstSpeaker}
        - Second intervenant: ${params.secondSpeaker}
        - Style: ${params.style}
        - Langue: français
        - Niveau de créativité: ${params.creativity}
        
        Le script doit être naturel, avec des pauses, des hésitations et des expressions conversationnelles françaises.
        La longueur du script doit être d'environ ${params.length} mots.
        `;
        break;
      case 'en':
        systemPrompt = "You are an expert podcast creator. You must generate a natural and engaging podcast script in English.";
        userPrompt = `
        Generate a podcast script between two people on the following topic:
        
        ${source.content}
        
        Script format:
        <Person1>First person's text</Person1>
        <Person2>Second person's text</Person2>
        
        Podcast details:
        - Podcast name: ${params.podcastName}
        - Tagline: ${params.tagline}
        - First speaker: ${params.firstSpeaker}
        - Second speaker: ${params.secondSpeaker}
        - Style: ${params.style}
        - Language: English
        - Creativity level: ${params.creativity}
        
        The script should be natural, with pauses, hesitations, and conversational English expressions.
        The script length should be approximately ${params.length} words.
        `;
        break;
      case 'es':
        systemPrompt = "Eres un experto creador de podcasts. Debes generar un guión de podcast natural y atractivo en español.";
        userPrompt = `
        Genera un guión de podcast entre dos personas sobre el siguiente tema:
        
        ${source.content}
        
        Formato del guión:
        <Person1>Texto de la primera persona</Person1>
        <Person2>Texto de la segunda persona</Person2>
        
        Detalles del podcast:
        - Nombre del podcast: ${params.podcastName}
        - Eslogan: ${params.tagline}
        - Primer interlocutor: ${params.firstSpeaker}
        - Segundo interlocutor: ${params.secondSpeaker}
        - Estilo: ${params.style}
        - Idioma: español
        - Nivel de creatividad: ${params.creativity}
        
        El guión debe ser natural, con pausas, vacilaciones y expresiones conversacionales españolas.
        La longitud del guión debe ser de aproximadamente ${params.length} palabras.
        `;
        break;
      default:
        // Pour les autres langues, utiliser l'anglais comme base et demander la traduction
        systemPrompt = `You are an expert podcast creator. You must generate a natural and engaging podcast script in ${params.language} language.`;
        userPrompt = `
        Generate a podcast script between two people on the following topic in ${params.language} language:
        
        ${source.content}
        
        Script format:
        <Person1>First person's text</Person1>
        <Person2>Second person's text</Person2>
        
        Podcast details:
        - Podcast name: ${params.podcastName}
        - Tagline: ${params.tagline}
        - First speaker: ${params.firstSpeaker}
        - Second speaker: ${params.secondSpeaker}
        - Style: ${params.style}
        - Language: ${params.language}
        - Creativity level: ${params.creativity}
        
        The script should be natural, with pauses, hesitations, and conversational expressions in ${params.language}.
        The script length should be approximately ${params.length} words.
        `;
    }
    
    console.log("Prompt préparé, appel à l'API OpenAI...");
    
    try {
      // Appeler l'API OpenAI pour générer la transcription
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: params.creativity,
        max_tokens: Math.min(4000, params.length * 4), // Estimation: 4 tokens par mot
      });
      
      console.log("Réponse reçue de l'API OpenAI");
      
      // Extraire la transcription générée
      const transcript = response.choices[0]?.message?.content || getTranscriptExample(params.language, params);
      
      console.log("Transcription générée avec succès");
      console.log("Extrait de la transcription:", transcript.substring(0, 100) + "...");
      
      return transcript;
    } catch (apiError: any) {
      console.error("Erreur lors de l'appel à l'API OpenAI:", apiError);
      // Afficher plus de détails sur l'erreur
      if (apiError.error) {
        console.error("Détails de l'erreur:", JSON.stringify(apiError.error, null, 2));
      }
      return getTranscriptExample(params.language, params);
    }
  } catch (error) {
    console.error("Erreur lors de la génération de la transcription:", error);
    return getTranscriptExample(params.language, params);
  }
}

// Fonction pour générer un fichier audio à partir d'une transcription
async function generateAudio(transcript: string, params: GenerationParams, apiConfig: ApiConfig): Promise<string> {
  try {
    console.log("=== GÉNÉRATION AUDIO ===");
    
    // Déterminer quelle API utiliser en fonction des clés disponibles et du modèle sélectionné
    if (params.ttsModel === 'openai' && apiConfig.openai) {
      console.log("Utilisation de l'API OpenAI pour la génération audio");
      return await generateOpenAIAudio(transcript, params, apiConfig.openai);
    } else if (params.ttsModel === 'edge') {
      console.log("Utilisation de l'API Edge TTS pour la génération audio");
      return await generateEdgeTTSAudio(transcript, params);
    } else if (params.ttsModel === 'elevenlabs' && apiConfig.elevenlabs) {
      console.log("Utilisation de l'API ElevenLabs pour la génération audio");
      return await generateElevenLabsAudio(transcript, params, apiConfig.elevenlabs);
    }
    
    // Si aucune API n'est disponible ou si le modèle n'est pas supporté,
    // utiliser le fichier audio d'exemple
    console.warn("Aucune API TTS disponible ou modèle non supporté, utilisation d'un fichier audio d'exemple");
    
    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const fileName = `podcast_${timestamp}.mp3`;
    const filePath = path.join(process.cwd(), 'public', 'audio', fileName);
    
    console.log("Création d'une copie du fichier audio d'exemple...");
    console.log("Chemin du fichier:", filePath);
    
    // Créer le dossier audio s'il n'existe pas
    try {
      const audioDir = path.join(process.cwd(), 'public', 'audio');
      await mkdir(audioDir, { recursive: true });
      console.log("Dossier audio créé ou existant:", audioDir);
    } catch (error) {
      console.error("Erreur lors de la création du dossier audio:", error);
      return `/audio/sample-podcast.mp3?t=${timestamp}`;
    }
    
    // Copier le fichier sample-podcast.mp3 vers le nouveau fichier
    try {
      // Chemin du fichier source
      const samplePath = path.join(process.cwd(), 'public', 'audio', 'sample-podcast.mp3');
      console.log("Fichier source:", samplePath);
      
      // Vérifier si le fichier source existe
      const fs = require('fs/promises');
      try {
        const stats = await fs.stat(samplePath);
        console.log("Fichier source existe:", stats.isFile());
      } catch (statError) {
        console.error("Erreur: Le fichier source n'existe pas:", statError);
        return `/audio/sample-podcast.mp3?t=${timestamp}`;
      }
      
      // Lire le fichier source
      console.log("Lecture du fichier source...");
      const data = await fs.readFile(samplePath);
      console.log("Fichier lu avec succès, taille:", data.length, "octets");
      
      // Écrire le nouveau fichier
      console.log("Écriture du nouveau fichier...");
      await fs.writeFile(filePath, data);
      console.log("Fichier écrit avec succès:", filePath);
      
      // Retourner l'URL du fichier audio
      return `/audio/${fileName}`;
    } catch (error) {
      console.error("Erreur lors de la copie du fichier audio:", error);
      return `/audio/sample-podcast.mp3?t=${timestamp}`;
    }
  } catch (error) {
    console.error("Erreur lors de la génération de l'audio:", error);
    return `/audio/sample-podcast.mp3?t=${Date.now()}`;
  }
}

// Fonction pour générer de l'audio avec OpenAI
async function generateOpenAIAudio(transcript: string, params: GenerationParams, apiKey: string): Promise<string> {
  try {
    console.log("Initialisation du client OpenAI pour la génération audio...");
    console.log("Voix sélectionnées - Premier intervenant:", params.firstSpeakerVoice, "Second intervenant:", params.secondSpeakerVoice);
    
    // Initialiser le client OpenAI
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // Extraire les dialogues de la transcription
    const dialogues = extractDialogues(transcript, params);
    
    // Vérifier si des dialogues ont été extraits
    if (dialogues.length === 0) {
      console.warn("Aucun dialogue n'a pu être extrait. Utilisation du texte brut.");
      dialogues.push({ 
        speaker: params.firstSpeaker, 
        text: transcript.trim(),
        voice: params.firstSpeakerVoice
      });
    }
    
    // Traiter l'ensemble de la transcription
    console.log(`Traitement de l'ensemble de la transcription (${dialogues.length} lignes de dialogue)...`);
    
    // Si le texte est trop long pour l'API OpenAI (limite de 4096 tokens),
    // nous le divisons en segments
    const MAX_CHARS_PER_SEGMENT = 4000; // Approximation pour rester sous la limite de tokens
    
    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const fileName = `podcast_${timestamp}.mp3`;
    const filePath = path.join(process.cwd(), 'public', 'audio', fileName);
    
    console.log("Génération de l'audio avec OpenAI...");
    
    try {
      // Créer le dossier audio s'il n'existe pas
      const audioDir = path.join(process.cwd(), 'public', 'audio');
      await mkdir(audioDir, { recursive: true });
      
      // Générer l'audio pour chaque dialogue avec la voix appropriée
      const audioBuffers: Buffer[] = [];
      
      for (let i = 0; i < dialogues.length; i++) {
        const dialogue = dialogues[i];
        
        // Vérifier si le texte est vide
        if (!dialogue.text || dialogue.text.trim().length === 0) {
          console.log(`Dialogue ${i+1} vide, ignoré.`);
          continue;
        }
        
        console.log(`Traitement du dialogue ${i+1}/${dialogues.length}:`);
        console.log(`- Intervenant: ${dialogue.speaker}`);
        console.log(`- Voix: ${dialogue.voice}`);
        console.log(`- Texte: ${dialogue.text.substring(0, 100)}...`);
        
        // Diviser le texte en segments si nécessaire
        const textSegments: string[] = [];
        if (dialogue.text.length > MAX_CHARS_PER_SEGMENT) {
          // Diviser le texte en segments
          let remainingText = dialogue.text;
          while (remainingText.length > 0) {
            const segment = remainingText.substring(0, MAX_CHARS_PER_SEGMENT);
            textSegments.push(segment);
            remainingText = remainingText.substring(MAX_CHARS_PER_SEGMENT);
          }
        } else {
          textSegments.push(dialogue.text);
        }
        
        // Générer l'audio pour chaque segment
        for (let j = 0; j < textSegments.length; j++) {
          const segment = textSegments[j];
          
          // Vérifier si le segment est vide
          if (!segment || segment.trim().length === 0) {
            console.log(`Segment ${j+1} vide, ignoré.`);
            continue;
          }
          
          console.log(`Génération du segment ${j+1}/${textSegments.length} pour le dialogue ${i+1}/${dialogues.length} (${segment.length} caractères)...`);
          
          // Utiliser l'API OpenAI pour générer l'audio
          console.log(`Appel à l'API OpenAI TTS avec la voix ${dialogue.voice}...`);
          
          try {
            // Vérifier que la voix est valide
            const validVoice = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].includes(dialogue.voice) 
              ? dialogue.voice 
              : "alloy";
            
            if (validVoice !== dialogue.voice) {
              console.warn(`Voix ${dialogue.voice} non reconnue, utilisation de la voix alloy par défaut.`);
            }
            
            const mp3Response = await openai.audio.speech.create({
              model: "tts-1",
              voice: validVoice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
              input: segment
            });
            
            console.log(`Réponse reçue de l'API OpenAI TTS pour le segment ${j+1}`);
            
            // Convertir la réponse en buffer
            const buffer = Buffer.from(await mp3Response.arrayBuffer());
            console.log(`Buffer créé pour le segment ${j+1}, taille:`, buffer.length, "octets");
            
            // Ajouter le buffer à la liste
            audioBuffers.push(buffer);
          } catch (segmentError) {
            console.error(`Erreur lors de la génération du segment ${j+1}:`, segmentError);
            // Continuer avec le segment suivant
          }
        }
      }
      
      // Vérifier si des segments audio ont été générés
      if (audioBuffers.length === 0) {
        console.error("Aucun segment audio n'a pu être généré. Utilisation du fichier audio d'exemple.");
        return `/audio/sample-podcast.mp3?t=${Date.now()}`;
      }
      
      // Combiner tous les buffers en un seul
      console.log("Combinaison des segments audio...");
      const combinedBuffer = Buffer.concat(audioBuffers);
      console.log("Buffer combiné, taille totale:", combinedBuffer.length, "octets");
      
      // Écrire le fichier audio
      console.log("Écriture du fichier audio:", filePath);
      await writeFile(filePath, combinedBuffer);
      console.log("Fichier audio écrit avec succès");
      
      // Retourner l'URL du fichier audio
      return `/audio/${fileName}`;
    } catch (apiError: any) {
      console.error("Erreur lors de l'appel à l'API OpenAI:", apiError);
      
      // Afficher plus de détails sur l'erreur
      if (apiError.error) {
        console.error("Détails de l'erreur:", JSON.stringify(apiError.error, null, 2));
      }
      
      // En cas d'erreur, utiliser le fichier audio d'exemple
      console.log("Utilisation du fichier audio d'exemple suite à une erreur");
      return `/audio/sample-podcast.mp3?t=${Date.now()}`;
    }
  } catch (error) {
    console.error("Erreur lors de la génération de l'audio avec OpenAI:", error);
    return `/audio/sample-podcast.mp3?t=${Date.now()}`;
  }
}

// Fonction pour générer de l'audio avec Microsoft Edge TTS
async function generateEdgeTTSAudio(transcript: string, params: GenerationParams): Promise<string> {
  try {
    console.log("Initialisation du client Edge TTS pour la génération audio...");
    console.log("Langue sélectionnée:", params.language);
    
    // Extraire les dialogues de la transcription
    // Convertir le format de dialogue pour Edge TTS
    const extractedDialogues = extractDialogues(transcript, params);
    const dialogues = extractedDialogues.map(d => ({
      speaker: d.speaker,
      text: d.text,
      isSpeaker1: d.voice === params.firstSpeakerVoice
    }));
    
    // Vérifier si des dialogues ont été extraits
    if (dialogues.length === 0) {
      console.warn("Aucun dialogue n'a pu être extrait. Utilisation du texte brut.");
      dialogues.push({ 
        speaker: params.firstSpeaker, 
        text: transcript.trim(),
        isSpeaker1: true
      });
    }
    
    // Traiter l'ensemble de la transcription
    console.log(`Traitement de l'ensemble de la transcription (${dialogues.length} lignes de dialogue)...`);
    
    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const fileName = `podcast_edge_${timestamp}.mp3`;
    const filePath = path.join(process.cwd(), 'public', 'audio', fileName);
    
    console.log("Génération de l'audio avec Edge TTS...");
    
    try {
      // Créer le dossier audio s'il n'existe pas
      const audioDir = path.join(process.cwd(), 'public', 'audio');
      await mkdir(audioDir, { recursive: true });
      
      // Utiliser le SDK Microsoft Cognitive Services pour générer l'audio
      // Créer un SpeechConfig pour le service Edge TTS
      const speechConfig = sdk.SpeechConfig.fromEndpoint(
        new URL("https://eastus.tts.speech.microsoft.com/cognitiveservices/v1"),
        ""  // Pas de clé API nécessaire pour Edge TTS
      );
      
      // Pas besoin de clé API pour Edge TTS
      
      // Créer un SpeechSynthesizer
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
      
      // Définir les voix en fonction de la langue
      let firstSpeakerVoice = "fr-FR-HenriNeural"; // Voix française masculine par défaut
      let secondSpeakerVoice = "fr-FR-DeniseNeural"; // Voix française féminine par défaut
      
      // Sélectionner les voix en fonction de la langue
      switch (params.language) {
        case 'fr':
          firstSpeakerVoice = "fr-FR-HenriNeural"; // Voix française masculine
          secondSpeakerVoice = "fr-FR-DeniseNeural"; // Voix française féminine
          break;
        case 'en':
          firstSpeakerVoice = "en-US-GuyNeural"; // Voix anglaise masculine
          secondSpeakerVoice = "en-US-JennyNeural"; // Voix anglaise féminine
          break;
        case 'es':
          firstSpeakerVoice = "es-ES-AlvaroNeural"; // Voix espagnole masculine
          secondSpeakerVoice = "es-ES-ElviraNeural"; // Voix espagnole féminine
          break;
        case 'de':
          firstSpeakerVoice = "de-DE-ConradNeural"; // Voix allemande masculine
          secondSpeakerVoice = "de-DE-KatjaNeural"; // Voix allemande féminine
          break;
        case 'it':
          firstSpeakerVoice = "it-IT-DiegoNeural"; // Voix italienne masculine
          secondSpeakerVoice = "it-IT-ElsaNeural"; // Voix italienne féminine
          break;
        case 'pt':
          firstSpeakerVoice = "pt-PT-DuarteNeural"; // Voix portugaise masculine
          secondSpeakerVoice = "pt-PT-RaquelNeural"; // Voix portugaise féminine
          break;
        case 'nl':
          firstSpeakerVoice = "nl-NL-MaartenNeural"; // Voix néerlandaise masculine
          secondSpeakerVoice = "nl-NL-ColetteNeural"; // Voix néerlandaise féminine
          break;
        case 'ru':
          firstSpeakerVoice = "ru-RU-DmitryNeural"; // Voix russe masculine
          secondSpeakerVoice = "ru-RU-SvetlanaNeural"; // Voix russe féminine
          break;
        case 'zh':
          firstSpeakerVoice = "zh-CN-YunxiNeural"; // Voix chinoise masculine
          secondSpeakerVoice = "zh-CN-XiaoxiaoNeural"; // Voix chinoise féminine
          break;
        case 'ja':
          firstSpeakerVoice = "ja-JP-KeitaNeural"; // Voix japonaise masculine
          secondSpeakerVoice = "ja-JP-NanamiNeural"; // Voix japonaise féminine
          break;
      }
      
      // Générer l'audio pour chaque dialogue avec la voix appropriée
      const audioBuffers: Buffer[] = [];
      
      for (let i = 0; i < dialogues.length; i++) {
        const dialogue = dialogues[i];
        const voiceName = dialogue.isSpeaker1 ? firstSpeakerVoice : secondSpeakerVoice;
        
        console.log(`Génération de l'audio pour le dialogue ${i+1}/${dialogues.length} avec la voix ${voiceName}...`);
        
        // Créer un SSML pour la synthèse vocale
        const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${params.language}">
          <voice name="${voiceName}">
            ${dialogue.text}
          </voice>
        </speak>
        `;
        
        // Générer l'audio
        try {
          const result = await new Promise<sdk.SpeechSynthesisResult>((resolve, reject) => {
            synthesizer.speakSsmlAsync(
              ssml,
              result => resolve(result),
              error => reject(error)
            );
          });
          
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            console.log(`Audio généré avec succès pour le dialogue ${i+1}`);
            
            // Convertir la réponse en buffer
            const buffer = Buffer.from(result.audioData);
            console.log(`Buffer créé pour le dialogue ${i+1}, taille:`, buffer.length, "octets");
            
            // Ajouter le buffer à la liste
            audioBuffers.push(buffer);
          } else {
            console.error(`Erreur lors de la synthèse vocale: ${result.errorDetails}`);
          }
        } catch (error) {
          console.error(`Erreur lors de la synthèse vocale: ${error}`);
        }
      }
      
      // Combiner tous les buffers en un seul
      console.log("Combinaison des segments audio...");
      const combinedBuffer = Buffer.concat(audioBuffers);
      console.log("Buffer combiné, taille totale:", combinedBuffer.length, "octets");
      
      // Écrire le fichier audio
      console.log("Écriture du fichier audio:", filePath);
      await writeFile(filePath, combinedBuffer);
      console.log("Fichier audio écrit avec succès");
      
      // Retourner l'URL du fichier audio
      return `/audio/${fileName}`;
    } catch (apiError: any) {
      console.error("Erreur lors de l'appel à l'API Edge TTS:", apiError);
      
      // En cas d'erreur, utiliser le fichier audio d'exemple
      console.log("Utilisation du fichier audio d'exemple suite à une erreur");
      return `/audio/sample-podcast.mp3?t=${Date.now()}`;
    }
  } catch (error) {
    console.error("Erreur lors de la génération de l'audio avec Edge TTS:", error);
    return `/audio/sample-podcast.mp3?t=${Date.now()}`;
  }
}

// Fonction pour générer de l'audio avec ElevenLabs
async function generateElevenLabsAudio(transcript: string, params: GenerationParams, apiKey: string): Promise<string> {
  try {
    console.log("Initialisation de l'API ElevenLabs pour la génération audio...");
    
    // Extraire les dialogues de la transcription
    const dialogues = extractDialogues(transcript, params);
    
    // Vérifier si des dialogues ont été extraits
    if (dialogues.length === 0) {
      console.warn("Aucun dialogue n'a pu être extrait. Utilisation du texte brut.");
      dialogues.push({ 
        speaker: params.firstSpeaker, 
        text: transcript.trim(),
        voice: params.firstSpeakerVoice
      });
    }
    
    // Traiter l'ensemble de la transcription
    console.log(`Traitement de l'ensemble de la transcription (${dialogues.length} lignes de dialogue)...`);
    
    // Combiner tous les dialogues en un seul texte
    const fullText = dialogues.map(d => d.text).join(' ');
    console.log("Longueur du texte complet:", fullText.length, "caractères");
    
    // Vérifier si le texte est vide
    if (fullText.trim().length === 0) {
      console.error("Le texte extrait est vide. Utilisation d'un texte par défaut.");
      return `/audio/sample-podcast.mp3?t=${Date.now()}`;
    }
    
    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const fileName = `podcast_elevenlabs_${timestamp}.mp3`;
    const filePath = path.join(process.cwd(), 'public', 'audio', fileName);
    
    console.log("Génération de l'audio avec ElevenLabs...");
    
    try {
      // Créer le dossier audio s'il n'existe pas
      const audioDir = path.join(process.cwd(), 'public', 'audio');
      await mkdir(audioDir, { recursive: true });
      
      // Pour cette démonstration, nous utilisons la voix "Rachel" d'ElevenLabs
      // Dans une implémentation complète, nous pourrions permettre à l'utilisateur de choisir la voix
      const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice ID
      
      // Paramètres de la voix
      const voiceSettings = {
        stability: 0.5,
        similarity_boost: 0.75
      };
      
      console.log("Appel à l'API REST ElevenLabs...");
      
      // Appel direct à l'API REST d'ElevenLabs
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: fullText,
          model_id: "eleven_multilingual_v2",
          voice_settings: voiceSettings
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erreur API ElevenLabs: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Erreur API ElevenLabs: ${response.status} ${response.statusText}`);
      }
      
      console.log("Réponse reçue de l'API ElevenLabs");
      
      // Convertir la réponse en buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log("Buffer créé, taille:", buffer.length, "octets");
      
      // Écrire le fichier audio
      console.log("Écriture du fichier audio:", filePath);
      await writeFile(filePath, buffer);
      console.log("Fichier audio écrit avec succès");
      
      // Retourner l'URL du fichier audio
      return `/audio/${fileName}`;
    } catch (apiError: any) {
      console.error("Erreur lors de l'appel à l'API ElevenLabs:", apiError);
      
      // En cas d'erreur, utiliser le fichier audio d'exemple
      console.log("Utilisation du fichier audio d'exemple suite à une erreur");
      return `/audio/sample-podcast.mp3?t=${Date.now()}`;
    }
  } catch (error) {
    console.error("Erreur lors de la génération de l'audio avec ElevenLabs:", error);
    return `/audio/sample-podcast.mp3?t=${Date.now()}`;
  }
}

// Fonction pour extraire les dialogues d'une transcription
function extractDialogues(transcript: string, params: GenerationParams): { speaker: string; text: string; voice: string }[] {
  console.log("Extraction des dialogues de la transcription...");
  console.log("Transcription brute:", transcript.substring(0, 200) + "...");
  
  // Nettoyer la transcription des éventuels en-têtes ou formatages Markdown
  let cleanedTranscript = transcript
    .replace(/^#.*$/gm, '') // Supprimer les titres Markdown
    .replace(/^\*\*.*\*\*$/gm, '') // Supprimer les lignes en gras
    .replace(/^_.*_$/gm, '') // Supprimer les lignes soulignées
    .replace(/^\s*[-*]\s+/gm, '') // Supprimer les listes à puces
    .replace(/\*\*.*?\*\*/g, '') // Supprimer le texte en gras
    .replace(/\*Tagline:.*?\*/g, '') // Supprimer la tagline
    .trim();
  
  console.log("Transcription nettoyée:", cleanedTranscript.substring(0, 200) + "...");
  
  const dialogues: { speaker: string; text: string; voice: string }[] = [];
  let hasMatches = false;
  
  // 1. Essayer d'extraire les dialogues au format <Person1>...</Person1>
  const personRegex = /<Person(\d+)>(.*?)<\/Person\d+>/g;
  let match;
  
  while ((match = personRegex.exec(cleanedTranscript)) !== null) {
    hasMatches = true;
    const speakerNumber = parseInt(match[1]);
    const text = match[2].trim();
    
    if (text.length > 0) {
      // Déterminer la voix à utiliser en fonction du numéro de l'intervenant
      const speaker = speakerNumber === 1 ? params.firstSpeaker : params.secondSpeaker;
      const voice = speakerNumber === 1 ? params.firstSpeakerVoice : params.secondSpeakerVoice;
      
      dialogues.push({ speaker, text, voice });
    }
  }
  
  // 2. Si aucun dialogue n'a été trouvé au format <Person1>, essayer le format avec *Nom:* texte
  if (!hasMatches) {
    console.log("Aucun dialogue trouvé au format <Person1>. Essai du format avec *Nom:* texte");
    
    // Format avec *Présentateur:* ou *Expert:* ou tout autre nom suivi de :*
    const speakerRegex = /\*([^:*]+)\s*:\*\s*(.*?)(?=\*[^:*]+\s*:\*|$)/g;
    while ((match = speakerRegex.exec(cleanedTranscript)) !== null) {
      hasMatches = true;
      const speaker = match[1].trim();
      const text = match[2].trim();
      
      if (text.length > 0) {
        // Déterminer la voix en fonction du rôle
        const isFirstSpeaker = speaker.toLowerCase().includes(params.firstSpeaker.toLowerCase());
        const voice = isFirstSpeaker ? params.firstSpeakerVoice : params.secondSpeakerVoice;
        dialogues.push({ speaker, text, voice });
      }
    }
  }
  
  // 3. Si toujours aucun dialogue, essayer le format avec Nom: texte (sans astérisques)
  if (!hasMatches) {
    console.log("Aucun dialogue trouvé au format *Nom:*. Essai du format avec Nom: texte");
    
    // Format avec Présentateur: ou Expert: ou tout autre nom suivi de :
    const lines = cleanedTranscript.split('\n');
    const simpleRegex = /^([^:]+)\s*:\s*(.+)$/;
    
    for (const line of lines) {
      const match = line.match(simpleRegex);
      if (match) {
        hasMatches = true;
        const speaker = match[1].trim();
        const text = match[2].trim();
        
        if (text.length > 0) {
          // Déterminer la voix en fonction du rôle
          const isFirstSpeaker = speaker.toLowerCase().includes(params.firstSpeaker.toLowerCase());
          const voice = isFirstSpeaker ? params.firstSpeakerVoice : params.secondSpeakerVoice;
          dialogues.push({ speaker, text, voice });
        }
      }
    }
  }
  
  // 4. Si toujours aucun dialogue, essayer de diviser par lignes
  if (!hasMatches) {
    console.log("Aucun dialogue trouvé dans les formats connus. Essai de division par lignes");
    
    const lines = cleanedTranscript.split('\n').filter(line => line.trim() !== '');
    let currentSpeaker = params.firstSpeaker;
    let currentVoice = params.firstSpeakerVoice;
    
    for (const line of lines) {
      if (line.trim().length > 0) {
        // Alterner entre les deux intervenants
        dialogues.push({ 
          speaker: currentSpeaker, 
          text: line.trim(),
          voice: currentVoice
        });
        
        // Changer d'intervenant pour la prochaine ligne
        if (currentSpeaker === params.firstSpeaker) {
          currentSpeaker = params.secondSpeaker;
          currentVoice = params.secondSpeakerVoice;
        } else {
          currentSpeaker = params.firstSpeaker;
          currentVoice = params.firstSpeakerVoice;
        }
      }
    }
    
    if (dialogues.length > 0) {
      hasMatches = true;
    }
  }
  
  // 5. Si toujours aucun dialogue, utiliser le texte complet
  if (!hasMatches || dialogues.length === 0) {
    console.log("Aucune méthode d'extraction n'a fonctionné. Utilisation du texte complet");
    
    // Diviser le texte en paragraphes
    const paragraphs = cleanedTranscript.split('\n\n').filter(p => p.trim().length > 0);
    
    if (paragraphs.length > 1) {
      // Alterner les paragraphes entre les deux intervenants
      let currentSpeaker = params.firstSpeaker;
      let currentVoice = params.firstSpeakerVoice;
      
      for (const paragraph of paragraphs) {
        if (paragraph.trim().length > 0) {
          dialogues.push({ 
            speaker: currentSpeaker, 
            text: paragraph.trim(),
            voice: currentVoice
          });
          
          // Changer d'intervenant pour le prochain paragraphe
          if (currentSpeaker === params.firstSpeaker) {
            currentSpeaker = params.secondSpeaker;
            currentVoice = params.secondSpeakerVoice;
          } else {
            currentSpeaker = params.firstSpeaker;
            currentVoice = params.firstSpeakerVoice;
          }
        }
      }
    } else {
      // Utiliser le texte complet
      dialogues.push({ 
        speaker: params.firstSpeaker, 
        text: cleanedTranscript,
        voice: params.firstSpeakerVoice
      });
    }
  }
  
  console.log(`Dialogues extraits: ${dialogues.length}`);
  dialogues.forEach((d, i) => {
    if (i < 3) {
      console.log(`Dialogue ${i+1}: ${d.speaker} (${d.voice}) - ${d.text.substring(0, 50)}...`);
    }
  });
  
  return dialogues;
}

// Fonction pour générer un podcast
async function generatePodcast(source: ContentSource, params: GenerationParams, apiConfig: ApiConfig) {
  try {
    console.log("Début de la génération du podcast...");
    console.log("Configuration API reçue:", JSON.stringify({
      openai: apiConfig.openai ? "Configuré" : "Non configuré",
      elevenlabs: apiConfig.elevenlabs ? "Configuré" : "Non configuré",
      gemini: apiConfig.gemini ? "Configuré" : "Non configuré"
    }));
    
    // Générer la transcription
    console.log("Étape 1: Génération de la transcription...");
    const transcript = await generateTranscript(source, params, apiConfig);
    
    // Générer l'audio à partir de la transcription
    console.log("Étape 2: Génération de l'audio...");
    const audioUrl = await generateAudio(transcript, params, apiConfig);
    
    console.log("Podcast généré avec succès!");
    console.log("URL audio:", audioUrl);
    
    // Retourner la réponse
    return {
      transcript,
      audioUrl,
      duration: 120, // Durée estimée en secondes
    };
  } catch (error) {
    console.error("Erreur lors de la génération du podcast:", error);
    
    // En cas d'erreur, retourner un exemple
    return {
      transcript: getTranscriptExample(params.language, params),
      audioUrl: `/audio/sample-podcast.mp3?t=${Date.now()}`,
      duration: 120,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("Requête API reçue");
    
    // Récupération des données de la requête
    const body = await request.json();
    const { source, params, apiConfig } = body;
    
    console.log("Données reçues:");
    console.log("- Source:", source ? source.type : "Non fournie");
    console.log("- Paramètres:", params ? "Fournis" : "Non fournis");
    console.log("- Configuration API:", apiConfig ? "Fournie" : "Non fournie");
    
    // Validation des données
    if (!source || !params) {
      console.error("Données manquantes: source ou params");
      return NextResponse.json(
        { error: 'Les données source et params sont requises' },
        { status: 400 }
      );
    }
    
    // Génération du podcast
    console.log("Début de la génération du podcast...");
    const result = await generatePodcast(source, params, apiConfig || {});
    
    // Retourne la réponse
    console.log("Réponse envoyée");
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erreur lors de la génération du podcast:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du podcast' },
      { status: 500 }
    );
  }
} 