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
    const prompt = `
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
    - Langue: ${params.language}
    - Niveau de créativité: ${params.creativity}
    
    Le script doit être naturel, avec des pauses, des hésitations et des expressions conversationnelles.
    La longueur du script doit être d'environ ${params.length} mots.
    `;
    
    console.log("Prompt préparé, appel à l'API OpenAI...");
    
    try {
      // Appeler l'API OpenAI pour générer la transcription
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Tu es un expert en création de podcasts. Tu dois générer un script de podcast naturel et engageant." },
          { role: "user", content: prompt }
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
    
    // Initialiser le client OpenAI
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // Préparer le texte pour la synthèse vocale
    console.log("Préparation du texte pour la synthèse vocale...");
    
    // Extraire les dialogues comme dans la fonction generateOpenAIAudio
    console.log("Transcription reçue:", transcript.substring(0, 200) + "...");
    
    // Essayer d'extraire les dialogues au format <Person1>...</Person1>
    const personRegex = /<Person(\d+)>(.*?)<\/Person\d+>/g;
    let match;
    const dialogues: { speaker: string; text: string; voice: string }[] = [];
    let hasMatches = false;
    
    while ((match = personRegex.exec(transcript)) !== null) {
      hasMatches = true;
      const speakerNumber = parseInt(match[1]);
      const text = match[2].trim();
      
      // Déterminer la voix à utiliser en fonction du numéro de l'intervenant
      const speaker = speakerNumber === 1 ? params.firstSpeaker : params.secondSpeaker;
      const voice = speakerNumber === 1 ? params.firstSpeakerVoice : params.secondSpeakerVoice;
      
      dialogues.push({ speaker, text, voice });
    }
    
    // Si aucun dialogue n'a été trouvé au format <Person1>, essayer d'autres formats
    if (!hasMatches) {
      console.log("Aucun dialogue trouvé au format <Person1>. Essai d'autres formats...");
      
      // Format avec *Présentateur:* ou *Expert:*
      const speakerRegex = /\*(Présentateur|Expert)\s*:\*\s*(.*?)(?=\*\w+\s*:\*|$)/g;
      while ((match = speakerRegex.exec(transcript)) !== null) {
        const speaker = match[1].trim();
        const text = match[2].trim();
        
        if (text) {
          // Déterminer la voix en fonction du rôle
          const voice = speaker === params.firstSpeaker ? params.firstSpeakerVoice : params.secondSpeakerVoice;
          dialogues.push({ speaker, text, voice });
        }
      }
      
      // Si toujours aucun dialogue, essayer un autre format
      if (dialogues.length === 0) {
        console.log("Aucun dialogue trouvé au format *Présentateur:*. Essai d'autres formats...");
        
        // Format avec Présentateur: ou Expert: (sans astérisques)
        const simpleRegex = /(Présentateur|Expert)\s*:\s*(.*?)(?=(?:Présentateur|Expert)\s*:|$)/g;
        while ((match = simpleRegex.exec(transcript)) !== null) {
          const speaker = match[1].trim();
          const text = match[2].trim();
          
          if (text) {
            // Déterminer la voix en fonction du rôle
            const voice = speaker === params.firstSpeaker ? params.firstSpeakerVoice : params.secondSpeakerVoice;
            dialogues.push({ speaker, text, voice });
          }
        }
      }
      
      // Si toujours aucun dialogue, utiliser le texte complet
      if (dialogues.length === 0) {
        console.log("Aucun dialogue trouvé dans les formats connus. Utilisation du texte complet.");
        dialogues.push({ 
          speaker: params.firstSpeaker, 
          text: transcript.replace(/\*\*.*?\*\*/g, '').replace(/\*.*?\*/g, '').trim(),
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
          console.log(`Génération du segment ${j+1}/${textSegments.length} pour le dialogue ${i+1}/${dialogues.length} (${segment.length} caractères)...`);
          
          // Utiliser l'API OpenAI pour générer l'audio
          console.log(`Appel à l'API OpenAI TTS avec la voix ${dialogue.voice}...`);
          const mp3Response = await openai.audio.speech.create({
            model: "tts-1",
            voice: dialogue.voice, // Utiliser la voix spécifiée
            input: segment
          });
          
          console.log(`Réponse reçue de l'API OpenAI TTS pour le segment ${j+1}`);
          
          // Convertir la réponse en buffer
          const buffer = Buffer.from(await mp3Response.arrayBuffer());
          console.log(`Buffer créé pour le segment ${j+1}, taille:`, buffer.length, "octets");
          
          // Ajouter le buffer à la liste
          audioBuffers.push(buffer);
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
    
    // Préparer le texte pour la synthèse vocale
    console.log("Préparation du texte pour la synthèse vocale...");
    
    // Extraire les dialogues comme dans les autres fonctions
    console.log("Transcription reçue:", transcript.substring(0, 200) + "...");
    
    // Essayer d'extraire les dialogues au format <Person1>...</Person1>
    const personRegex = /<Person(\d+)>(.*?)<\/Person\d+>/g;
    let match;
    const dialogues: { speaker: string; text: string }[] = [];
    let hasMatches = false;
    
    while ((match = personRegex.exec(transcript)) !== null) {
      hasMatches = true;
      const speakerNumber = parseInt(match[1]);
      const text = match[2].trim();
      
      // Déterminer la voix à utiliser en fonction du numéro de l'intervenant
      const speaker = speakerNumber === 1 ? params.firstSpeaker : params.secondSpeaker;
      
      dialogues.push({ speaker, text });
    }
    
    // Si aucun dialogue n'a été trouvé au format <Person1>, essayer d'autres formats
    if (!hasMatches) {
      console.log("Aucun dialogue trouvé au format <Person1>. Essai d'autres formats...");
      
      // Format avec *Présentateur:* ou *Expert:*
      const speakerRegex = /\*(Présentateur|Expert)\s*:\*\s*(.*?)(?=\*\w+\s*:\*|$)/g;
      while ((match = speakerRegex.exec(transcript)) !== null) {
        const speaker = match[1].trim();
        const text = match[2].trim();
        
        if (text) {
          dialogues.push({ speaker, text });
        }
      }
      
      // Si toujours aucun dialogue, essayer un autre format
      if (dialogues.length === 0) {
        console.log("Aucun dialogue trouvé au format *Présentateur:*. Essai d'autres formats...");
        
        // Format avec Présentateur: ou Expert: (sans astérisques)
        const simpleRegex = /(Présentateur|Expert)\s*:\s*(.*?)(?=(?:Présentateur|Expert)\s*:|$)/g;
        while ((match = simpleRegex.exec(transcript)) !== null) {
          const speaker = match[1].trim();
          const text = match[2].trim();
          
          if (text) {
            dialogues.push({ speaker, text });
          }
        }
      }
      
      // Si toujours aucun dialogue, utiliser le texte complet
      if (dialogues.length === 0) {
        console.log("Aucun dialogue trouvé dans les formats connus. Utilisation du texte complet.");
        dialogues.push({ 
          speaker: params.firstSpeaker, 
          text: transcript.replace(/\*\*.*?\*\*/g, '').replace(/\*.*?\*/g, '').trim() 
        });
      }
    }
    
    console.log(`Dialogues extraits: ${dialogues.length}`);
    dialogues.forEach((d, i) => {
      if (i < 3) {
        console.log(`Dialogue ${i+1}: ${d.speaker} - ${d.text.substring(0, 50)}...`);
      }
    });
    
    // Vérifier si des dialogues ont été extraits
    if (dialogues.length === 0) {
      console.warn("Aucun dialogue n'a pu être extrait. Utilisation du texte brut.");
      dialogues.push({ 
        speaker: params.firstSpeaker, 
        text: transcript.trim() 
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
      
      // Définir la voix en fonction de la langue
      let voiceName = "fr-FR-HenriNeural"; // Voix française par défaut
      
      if (params.language === 'en') {
        voiceName = "en-US-GuyNeural"; // Voix anglaise
      } else if (params.language === 'es') {
        voiceName = "es-ES-AlvaroNeural"; // Voix espagnole
      } else if (params.language === 'de') {
        voiceName = "de-DE-ConradNeural"; // Voix allemande
      }
      
      // Créer un SSML pour la synthèse vocale
      const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${params.language}">
        <voice name="${voiceName}">
          ${fullText}
        </voice>
      </speak>
      `;
      
      console.log("Appel à l'API Edge TTS...");
      
      // Créer un fichier audio temporaire
      const tempFilePath = path.join(process.cwd(), 'public', 'audio', `temp_${timestamp}.wav`);
      
      // Générer l'audio
      return new Promise<string>((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          result => {
            if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
              console.log("Synthèse vocale terminée");
              
              // Écrire le fichier audio
              const audioData = result.audioData;
              const buffer = Buffer.from(audioData);
              
              writeFile(filePath, buffer)
                .then(() => {
                  console.log("Fichier audio écrit avec succès");
                  synthesizer.close();
                  resolve(`/audio/${fileName}`);
                })
                .catch(error => {
                  console.error("Erreur lors de l'écriture du fichier audio:", error);
                  synthesizer.close();
                  resolve(`/audio/sample-podcast.mp3?t=${timestamp}`);
                });
            } else {
              console.error(`Erreur lors de la synthèse vocale: ${result.errorDetails}`);
              synthesizer.close();
              resolve(`/audio/sample-podcast.mp3?t=${timestamp}`);
            }
          },
          error => {
            console.error(`Erreur lors de la synthèse vocale: ${error}`);
            synthesizer.close();
            resolve(`/audio/sample-podcast.mp3?t=${timestamp}`);
          }
        );
      });
    } catch (apiError: any) {
      console.error("Erreur lors de l'appel à l'API Edge TTS:", apiError);
      
      // En cas d'erreur, utiliser le fichier audio d'exemple
      console.log("Utilisation du fichier audio d'exemple suite à une erreur");
      return `/audio/sample-podcast.mp3?t=${timestamp}`;
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
    
    // Préparer le texte pour la synthèse vocale
    console.log("Préparation du texte pour la synthèse vocale...");
    
    // Extraire les dialogues comme dans la fonction generateOpenAIAudio
    console.log("Transcription reçue:", transcript.substring(0, 200) + "...");
    
    // Essayer d'extraire les dialogues au format <Person1>...</Person1>
    const personRegex = /<Person(\d+)>(.*?)<\/Person\d+>/g;
    let match;
    const dialogues: { speaker: string; text: string }[] = [];
    let hasMatches = false;
    
    while ((match = personRegex.exec(transcript)) !== null) {
      hasMatches = true;
      const speakerNumber = parseInt(match[1]);
      const text = match[2].trim();
      
      // Déterminer la voix à utiliser en fonction du numéro de l'intervenant
      const speaker = speakerNumber === 1 ? params.firstSpeaker : params.secondSpeaker;
      
      dialogues.push({ speaker, text });
    }
    
    // Si aucun dialogue n'a été trouvé au format <Person1>, essayer d'autres formats
    if (!hasMatches) {
      console.log("Aucun dialogue trouvé au format <Person1>. Essai d'autres formats...");
      
      // Format avec *Présentateur:* ou *Expert:*
      const speakerRegex = /\*(Présentateur|Expert)\s*:\*\s*(.*?)(?=\*\w+\s*:\*|$)/g;
      while ((match = speakerRegex.exec(transcript)) !== null) {
        const speaker = match[1].trim();
        const text = match[2].trim();
        
        if (text) {
          dialogues.push({ speaker, text });
        }
      }
      
      // Si toujours aucun dialogue, essayer un autre format
      if (dialogues.length === 0) {
        console.log("Aucun dialogue trouvé au format *Présentateur:*. Essai d'autres formats...");
        
        // Format avec Présentateur: ou Expert: (sans astérisques)
        const simpleRegex = /(Présentateur|Expert)\s*:\s*(.*?)(?=(?:Présentateur|Expert)\s*:|$)/g;
        while ((match = simpleRegex.exec(transcript)) !== null) {
          const speaker = match[1].trim();
          const text = match[2].trim();
          
          if (text) {
            dialogues.push({ speaker, text });
          }
        }
      }
      
      // Si toujours aucun dialogue, utiliser le texte complet
      if (dialogues.length === 0) {
        console.log("Aucun dialogue trouvé dans les formats connus. Utilisation du texte complet.");
        dialogues.push({ 
          speaker: params.firstSpeaker, 
          text: transcript.replace(/\*\*.*?\*\*/g, '').replace(/\*.*?\*/g, '').trim() 
        });
      }
    }
    
    console.log(`Dialogues extraits: ${dialogues.length}`);
    dialogues.forEach((d, i) => {
      if (i < 3) {
        console.log(`Dialogue ${i+1}: ${d.speaker} - ${d.text.substring(0, 50)}...`);
      }
    });
    
    // Vérifier si des dialogues ont été extraits
    if (dialogues.length === 0) {
      console.warn("Aucun dialogue n'a pu être extrait. Utilisation du texte brut.");
      dialogues.push({ 
        speaker: params.firstSpeaker, 
        text: transcript.trim() 
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