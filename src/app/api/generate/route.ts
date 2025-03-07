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
    
    // Limiter la taille du contenu source pour éviter les dépassements de contexte
    let contentToUse = source.content;
    const maxContentLength = 8000; // Limite approximative pour éviter de dépasser la limite de tokens
    
    if (contentToUse.length > maxContentLength) {
      console.warn(`Contenu source trop long (${contentToUse.length} caractères), tronqué à ${maxContentLength} caractères.`);
      contentToUse = contentToUse.substring(0, maxContentLength) + "...";
    }
    
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
        
        ${contentToUse}
        
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
        
        IMPORTANT: Assure-toi que le podcast a une introduction claire et une conclusion appropriée. La conclusion doit résumer les points clés et remercier l'auditeur.
        `;
        break;
      case 'en':
        systemPrompt = "You are an expert podcast creator. You must generate a natural and engaging podcast script in English.";
        userPrompt = `
        Generate a podcast script between two people on the following topic:
        
        ${contentToUse}
        
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
        
        IMPORTANT: Make sure the podcast has a clear introduction and a proper conclusion. The conclusion should summarize the key points and thank the listener.
        `;
        break;
      case 'es':
        systemPrompt = "Eres un experto creador de podcasts. Debes generar un guión de podcast natural y atractivo en español.";
        userPrompt = `
        Genera un guión de podcast entre dos personas sobre el siguiente tema:
        
        ${contentToUse}
        
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
        
        IMPORTANTE: Asegúrate de que el podcast tenga una introducción clara y una conclusión adecuada. La conclusión debe resumir los puntos clave y agradecer al oyente.
        `;
        break;
      default:
        // Pour les autres langues, utiliser l'anglais comme base et demander la traduction
        systemPrompt = `You are an expert podcast creator. You must generate a natural and engaging podcast script in ${params.language} language.`;
        userPrompt = `
        Generate a podcast script between two people on the following topic in ${params.language} language:
        
        ${contentToUse}
        
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
        
        IMPORTANT: Make sure the podcast has a clear introduction and a proper conclusion. The conclusion should summarize the key points and thank the listener.
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
      
      // Vérifier si c'est une erreur de dépassement de contexte
      if (apiError.code === 'context_length_exceeded' || 
          (apiError.error && apiError.error.code === 'context_length_exceeded') ||
          (apiError.message && apiError.message.includes('maximum context length'))) {
        
        console.warn("Erreur de dépassement de contexte. Réduction de la taille du contenu et nouvel essai...");
        
        // Réduire davantage la taille du contenu
        const reducedLength = Math.floor(maxContentLength / 2);
        contentToUse = source.content.substring(0, reducedLength) + "...";
        
        // Reconstruire le prompt avec le contenu réduit
        switch (params.language) {
          case 'fr':
            // Utiliser une approche sans le flag 's' (dotAll)
            const frParts = userPrompt.split('Format du script:');
            if (frParts.length > 1) {
              const beforePart = frParts[0].split('Génère un script de podcast entre deux personnes sur le sujet suivant:')[0];
              userPrompt = `${beforePart}Génère un script de podcast entre deux personnes sur le sujet suivant:\n\n${contentToUse}\n\nFormat du script:${frParts[1]}`;
            }
            break;
          case 'en':
            // Utiliser une approche sans le flag 's' (dotAll)
            const enParts = userPrompt.split('Script format:');
            if (enParts.length > 1) {
              const beforePart = enParts[0].split('Generate a podcast script between two people on the following topic:')[0];
              userPrompt = `${beforePart}Generate a podcast script between two people on the following topic:\n\n${contentToUse}\n\nScript format:${enParts[1]}`;
            }
            break;
          case 'es':
            // Utiliser une approche sans le flag 's' (dotAll)
            const esParts = userPrompt.split('Formato del guión:');
            if (esParts.length > 1) {
              const beforePart = esParts[0].split('Genera un guión de podcast entre dos personas sobre el siguiente tema:')[0];
              userPrompt = `${beforePart}Genera un guión de podcast entre dos personas sobre el siguiente tema:\n\n${contentToUse}\n\nFormato del guión:${esParts[1]}`;
            }
            break;
          default:
            // Utiliser une approche sans le flag 's' (dotAll)
            const defaultParts = userPrompt.split('Script format:');
            if (defaultParts.length > 1) {
              // Trouver la partie avant le contenu
              const beforeContent = defaultParts[0].split(`Generate a podcast script between two people on the following topic in ${params.language} language:`)[0];
              userPrompt = `${beforeContent}Generate a podcast script between two people on the following topic in ${params.language} language:\n\n${contentToUse}\n\nScript format:${defaultParts[1]}`;
            }
        }
        
        // Nouvel essai avec le contenu réduit
        try {
          console.log("Nouvel essai avec contenu réduit...");
          const retryResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: params.creativity,
            max_tokens: Math.min(4000, params.length * 4),
          });
          
          const retryTranscript = retryResponse.choices[0]?.message?.content || getTranscriptExample(params.language, params);
          
          console.log("Transcription générée avec succès après réduction du contenu");
          console.log("Extrait de la transcription:", retryTranscript.substring(0, 100) + "...");
          
          return retryTranscript;
        } catch (retryError) {
          console.error("Échec du second essai:", retryError);
          return getTranscriptExample(params.language, params);
        }
      }
      
      // Pour les autres types d'erreurs, utiliser l'exemple de transcript
      return getTranscriptExample(params.language, params);
    }
  } catch (error) {
    console.error("Erreur lors de la génération de la transcription:", error);
    return getTranscriptExample(params.language, params);
  }
}

// Fonction pour générer un fichier audio à partir d'une transcription
async function generateAudio(transcript: string, params: GenerationParams, apiConfig: ApiConfig): Promise<string> {
  console.log("=== GÉNÉRATION AUDIO ===");
  
  // Vérifier le modèle TTS sélectionné
  switch (params.ttsModel) {
    case 'openai':
      if (!apiConfig.openai) {
        throw new Error('Clé API OpenAI non configurée. Veuillez configurer votre clé API dans les paramètres.');
      }
      console.log("Utilisation de l'API OpenAI pour la génération audio");
      return await generateOpenAIAudio(transcript, params, apiConfig.openai);
      
    case 'elevenlabs':
      if (!apiConfig.elevenlabs) {
        throw new Error('Clé API ElevenLabs non configurée. Veuillez configurer votre clé API dans les paramètres.');
      }
      console.log("Utilisation de l'API ElevenLabs pour la génération audio");
      return await generateElevenLabsAudio(transcript, params, apiConfig.elevenlabs);
      
    case 'edge':
      console.log("Utilisation d'Edge TTS pour la génération audio");
      return await generateEdgeTTSAudio(transcript, params);
      
    default:
      throw new Error(`Modèle TTS non supporté: ${params.ttsModel}`);
  }
}

// Fonction pour générer de l'audio avec OpenAI
async function generateOpenAIAudio(transcript: string, params: GenerationParams, apiKey: string): Promise<string> {
  try {
    console.log('Initialisation de l\'API OpenAI pour la génération audio...');
    
    // Initialiser le client OpenAI
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    // Extraire les dialogues
    console.log('Extraction des dialogues de la transcription...');
    const dialogues = extractDialogues(transcript, params);
    
    if (dialogues.length === 0) {
      console.warn('Aucun dialogue n\'a pu être extrait de la transcription. Utilisation de l\'audio d\'exemple.');
      return `/audio/sample-podcast.mp3?t=${Date.now()}`;
    }
    
    console.log(`Dialogues extraits: ${dialogues.length}`);
    
    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const audioFilename = `podcast_openai_${timestamp}.mp3`;
    const audioPath = path.join(process.cwd(), 'public', 'audio', audioFilename);
    
    // Créer le répertoire audio s'il n'existe pas
    try {
      await mkdir(path.join(process.cwd(), 'public', 'audio'), { recursive: true });
    } catch (error) {
      console.warn('Erreur lors de la création du répertoire audio. Utilisation de l\'audio d\'exemple.');
      return `/audio/sample-podcast.mp3?t=${Date.now()}`;
    }
    
    // Tester l'API OpenAI
    try {
      // Tester l'API OpenAI avec un petit texte
      const testResponse = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: "Test de l'API OpenAI"
      });
      
      if (!testResponse) {
        console.warn('Erreur lors de la connexion à l\'API OpenAI. Utilisation de l\'audio d\'exemple.');
        return `/audio/sample-podcast.mp3?t=${Date.now()}`;
      }
      
      // Si le test a réussi, générer l'audio pour tous les dialogues
      console.log('Test de l\'API OpenAI réussi. Génération de l\'audio pour tous les dialogues...');
      
      // Augmenter le nombre maximum de dialogues
      const maxDialogues = Math.min(dialogues.length, 15); // Augmenter à 15 dialogues maximum
      console.log(`Génération audio pour ${maxDialogues} dialogues sur ${dialogues.length} au total`);
      
      // Tableau pour stocker les buffers audio
      const audioBuffers: Buffer[] = [];
      
      // Vérifier si le dernier dialogue semble être une conclusion
      const hasProperConclusion = dialogues.length > 0 && 
        (dialogues[dialogues.length - 1].text.toLowerCase().includes('merci') || 
         dialogues[dialogues.length - 1].text.toLowerCase().includes('conclusion') ||
         dialogues[dialogues.length - 1].text.toLowerCase().includes('au revoir') ||
         dialogues[dialogues.length - 1].text.toLowerCase().includes('à bientôt'));
      
      // Générer l'audio pour chaque dialogue
      for (let i = 0; i < maxDialogues; i++) {
        const dialogue = dialogues[i];
        if (!dialogue || !dialogue.text.trim()) {
          console.log(`Dialogue ${i+1} vide, ignoré.`);
          continue;
        }
        
        // Nettoyer le texte du dialogue (enlever les balises, etc.)
        let cleanText = dialogue.text
          .replace(/<[^>]+>/g, '') // Supprimer les balises HTML
          .replace(/^\*.*?\*/g, '') // Supprimer les textes entre *
          .replace(/\*[^*]*\*/g, '') // Supprimer les textes entre * (au milieu du texte)
          .trim();
          
        if (!cleanText) {
          console.log(`Dialogue ${i+1} vide après nettoyage, ignoré.`);
          continue;
        }
        
        // Limiter la longueur du texte pour éviter les erreurs
        if (cleanText.length > 4000) {
          console.log(`Dialogue ${i+1} trop long (${cleanText.length} caractères), tronqué à 4000 caractères.`);
          cleanText = cleanText.substring(0, 4000);
        }
        
        // Déterminer la voix à utiliser en fonction du locuteur
        let voice: string;
        
        // Vérifier si le dialogue contient le nom du premier ou du second intervenant
        const speakerLower = dialogue.speaker.toLowerCase();
        const firstSpeakerLower = params.firstSpeaker.toLowerCase();
        const secondSpeakerLower = params.secondSpeaker.toLowerCase();
        
        if (speakerLower.includes(firstSpeakerLower) || firstSpeakerLower.includes(speakerLower)) {
          voice = params.firstSpeakerVoice;
          console.log(`Dialogue ${i+1} attribué au premier intervenant (${params.firstSpeaker}), voix: ${voice}`);
        } else if (speakerLower.includes(secondSpeakerLower) || secondSpeakerLower.includes(speakerLower)) {
          voice = params.secondSpeakerVoice;
          console.log(`Dialogue ${i+1} attribué au second intervenant (${params.secondSpeaker}), voix: ${voice}`);
        } else {
          // Si on ne peut pas déterminer le locuteur, alterner les voix
          voice = i % 2 === 0 ? params.firstSpeakerVoice : params.secondSpeakerVoice;
          console.log(`Dialogue ${i+1} attribué par alternance, voix: ${voice}`);
        }
        
        console.log(`Génération audio pour dialogue ${i+1}/${maxDialogues}: ${dialogue.speaker} avec la voix ${voice}`);
        console.log(`Texte: ${cleanText.substring(0, 100)}...`);
        
        try {
          // Générer l'audio avec la langue spécifiée
          const mp3Response = await openai.audio.speech.create({
            model: "tts-1",
            voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
            input: cleanText,
            response_format: "mp3",
            speed: 1.0
          });
          
          // Convertir la réponse en buffer
          const buffer = Buffer.from(await mp3Response.arrayBuffer());
          console.log(`Audio généré pour le dialogue ${i+1}, taille: ${buffer.length} octets`);
          
          // Ajouter le buffer au tableau
          audioBuffers.push(buffer);
        } catch (dialogueError) {
          console.error(`Erreur lors de la génération audio pour le dialogue ${i+1}:`, dialogueError);
          // Continuer avec le dialogue suivant
        }
      }
      
      // Ajouter une conclusion si nécessaire
      if (!hasProperConclusion && dialogues.length > 0) {
        console.log("Ajout d'une conclusion au podcast...");
        
        // Déterminer la voix pour la conclusion (utiliser la voix du premier intervenant)
        const conclusionVoice = params.firstSpeakerVoice;
        
        // Texte de conclusion
        const conclusionText = `Merci d'avoir écouté cet épisode de ${params.podcastName}. Nous espérons que cette discussion vous a été utile. À bientôt pour un nouvel épisode !`;
        
        try {
          // Générer l'audio pour la conclusion
          const conclusionResponse = await openai.audio.speech.create({
            model: "tts-1",
            voice: conclusionVoice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
            input: conclusionText,
            response_format: "mp3",
            speed: 1.0
          });
          
          // Convertir la réponse en buffer
          const conclusionBuffer = Buffer.from(await conclusionResponse.arrayBuffer());
          console.log(`Audio généré pour la conclusion, taille: ${conclusionBuffer.length} octets`);
          
          // Ajouter le buffer de conclusion au tableau
          audioBuffers.push(conclusionBuffer);
        } catch (conclusionError) {
          console.error("Erreur lors de la génération audio pour la conclusion:", conclusionError);
        }
      }
      
      // Vérifier si des buffers ont été générés
      if (audioBuffers.length === 0) {
        console.warn('Aucun audio n\'a pu être généré. Utilisation de l\'audio d\'exemple.');
        return `/audio/sample-podcast.mp3?t=${Date.now()}`;
      }
      
      // Combiner tous les buffers en un seul
      const combinedBuffer = Buffer.concat(audioBuffers);
      console.log(`Audio combiné, taille totale: ${combinedBuffer.length} octets`);
      
      // Écrire le fichier audio
      await writeFile(audioPath, combinedBuffer);
      
      console.log(`Audio généré avec succès: ${audioPath}`);
      return `/audio/${audioFilename}`;
      
    } catch (error: any) {
      let errorMessage = 'Erreur lors de la génération audio avec OpenAI';
      
      if (error.status === 401) {
        errorMessage = 'Clé API OpenAI invalide. Veuillez vérifier votre clé API.';
      } else if (error.status === 429) {
        errorMessage = 'Quota OpenAI dépassé. Veuillez mettre à niveau votre abonnement ou réessayer plus tard.';
      } else if (error.message) {
        errorMessage = `Erreur OpenAI: ${error.message}`;
      }
      
      console.error(errorMessage, error);
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Erreur lors de la génération audio avec OpenAI:', error);
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
    console.log('Initialisation de l\'API ElevenLabs pour la génération audio...');
    console.log(`Voix ElevenLabs sélectionnées - Premier intervenant: ${params.firstSpeakerElevenLabsVoiceId} Second intervenant: ${params.secondSpeakerElevenLabsVoiceId}`);
    console.log(`Langue sélectionnée: ${params.language}`);
    
    // Extraction des dialogues
    console.log('Extraction des dialogues de la transcription...');
    console.log(`Transcription brute: ${transcript.substring(0, 100)}...`);
    
    // Nettoyer la transcription
    const cleanedTranscript = transcript
      .replace(/^#+ .*$/gm, '') // Supprimer les titres Markdown
      .replace(/\*\*(.*?)\*\*/g, '$1') // Supprimer les textes en gras
      .replace(/^_.*_$/gm, '') // Supprimer les lignes soulignées
      .replace(/^\* /gm, '') // Supprimer les puces
      .replace(/^Tagline:.*$/gm, ''); // Supprimer les taglines
    
    console.log(`Transcription nettoyée: ${cleanedTranscript.substring(0, 100)}...`);
    
    // Extraire les dialogues
    const dialogues = extractDialogues(cleanedTranscript, params);
    
    if (dialogues.length === 0) {
      console.warn('Aucun dialogue n\'a pu être extrait de la transcription. Utilisation de l\'audio d\'exemple.');
      return `/audio/sample-podcast.mp3?t=${Date.now()}`;
    }
    
    console.log(`Dialogues extraits: ${dialogues.length}`);
    for (let i = 0; i < Math.min(3, dialogues.length); i++) {
      console.log(`Dialogue ${i+1}: ${dialogues[i].speaker} (${dialogues[i].voice}) - ${dialogues[i].text.substring(0, 50)}...`);
    }
    
    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const audioFilename = `podcast_elevenlabs_${timestamp}.mp3`;
    const audioPath = path.join(process.cwd(), 'public', 'audio', audioFilename);
    
    // Créer le répertoire audio s'il n'existe pas
    try {
      await mkdir(path.join(process.cwd(), 'public', 'audio'), { recursive: true });
    } catch (error) {
      console.warn('Erreur lors de la création du répertoire audio. Utilisation de l\'audio d\'exemple.');
      return `/audio/sample-podcast.mp3?t=${Date.now()}`;
    }
    
    // Vérifier si l'API ElevenLabs est disponible
    try {
      const testResponse = await fetch('https://api.elevenlabs.io/v1/user', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': apiKey
        }
      });
      
      if (!testResponse.ok) {
        let errorMessage = `Erreur API ElevenLabs: ${testResponse.status} ${testResponse.statusText}`;
        
        try {
          const errorData = await testResponse.json();
          if (errorData.detail && errorData.detail.status === 'quota_exceeded') {
            errorMessage = 'Quota ElevenLabs dépassé. Veuillez mettre à niveau votre abonnement ou réessayer plus tard.';
          } else if (errorData.detail && errorData.detail.status === 'detected_unusual_activity') {
            errorMessage = 'Activité inhabituelle détectée par ElevenLabs. Veuillez utiliser un autre service TTS ou contacter le support ElevenLabs.';
          }
        } catch (e) {
          // Ignorer les erreurs de parsing JSON
        }
        
        console.warn(errorMessage + ' Utilisation de l\'audio d\'exemple.');
        return `/audio/sample-podcast.mp3?t=${Date.now()}`;
      }
      
      // Si le test a réussi, générer l'audio pour tous les dialogues
      console.log('Test de l\'API ElevenLabs réussi. Génération de l\'audio pour tous les dialogues...');
      
      // Limiter le nombre de dialogues pour éviter les problèmes de quota
      const maxDialogues = Math.min(dialogues.length, 5); // Limiter à 5 dialogues maximum
      console.log(`Génération audio pour ${maxDialogues} dialogues sur ${dialogues.length} au total`);
      
      // Tableau pour stocker les buffers audio
      const audioBuffers: Buffer[] = [];
      
      // Générer l'audio pour chaque dialogue
      for (let i = 0; i < maxDialogues; i++) {
        const dialogue = dialogues[i];
        if (!dialogue || !dialogue.text.trim()) {
          console.log(`Dialogue ${i+1} vide, ignoré.`);
          continue;
        }
        
        // Nettoyer le texte du dialogue (enlever les balises, etc.)
        let cleanText = dialogue.text
          .replace(/<[^>]+>/g, '') // Supprimer les balises HTML
          .replace(/^\*.*?\*/g, '') // Supprimer les textes entre *
          .replace(/\*[^*]*\*/g, '') // Supprimer les textes entre * (au milieu du texte)
          .trim();
          
        if (!cleanText) {
          console.log(`Dialogue ${i+1} vide après nettoyage, ignoré.`);
          continue;
        }
        
        // Limiter la longueur du texte pour éviter les erreurs
        if (cleanText.length > 5000) {
          console.log(`Dialogue ${i+1} trop long (${cleanText.length} caractères), tronqué à 5000 caractères.`);
          cleanText = cleanText.substring(0, 5000);
        }
        
        // Déterminer la voix à utiliser en fonction du locuteur
        let voiceId: string;
        
        // Vérifier si le dialogue contient le nom du premier ou du second intervenant
        const speakerLower = dialogue.speaker.toLowerCase();
        const firstSpeakerLower = params.firstSpeaker.toLowerCase();
        const secondSpeakerLower = params.secondSpeaker.toLowerCase();
        
        if (speakerLower.includes(firstSpeakerLower) || firstSpeakerLower.includes(speakerLower)) {
          voiceId = params.firstSpeakerElevenLabsVoiceId;
          console.log(`Dialogue ${i+1} attribué au premier intervenant (${params.firstSpeaker}), voix ElevenLabs: ${voiceId}`);
        } else if (speakerLower.includes(secondSpeakerLower) || secondSpeakerLower.includes(speakerLower)) {
          voiceId = params.secondSpeakerElevenLabsVoiceId;
          console.log(`Dialogue ${i+1} attribué au second intervenant (${params.secondSpeaker}), voix ElevenLabs: ${voiceId}`);
        } else {
          // Si on ne peut pas déterminer le locuteur, alterner les voix
          voiceId = i % 2 === 0 ? params.firstSpeakerElevenLabsVoiceId : params.secondSpeakerElevenLabsVoiceId;
          console.log(`Dialogue ${i+1} attribué par alternance, voix ElevenLabs: ${voiceId}`);
        }
        
        console.log(`Génération audio pour dialogue ${i+1}/${maxDialogues}: ${dialogue.speaker}`);
        console.log(`Texte: ${cleanText.substring(0, 100)}...`);
        
        try {
          // Appel à l'API ElevenLabs
          console.log(`Appel à l'API REST ElevenLabs pour le dialogue ${i+1}...`);
          
          // Mapper la langue sélectionnée au format ElevenLabs
          // ElevenLabs supporte: en, de, es, fr, hi, it, ja, ko, pl, pt, ru, tr, zh
          let modelId = 'eleven_multilingual_v2';
          
          // Déterminer la langue pour ElevenLabs
          const languageMap: Record<string, string> = {
            'fr': 'fr', // Français
            'en': 'en', // Anglais
            'de': 'de', // Allemand
            'es': 'es', // Espagnol
            'it': 'it', // Italien
            'pt': 'pt', // Portugais
            'nl': 'en', // Néerlandais (fallback à l'anglais)
            'ru': 'ru', // Russe
            'zh': 'zh', // Chinois
            'ja': 'ja'  // Japonais
          };
          
          // Obtenir le code de langue pour ElevenLabs ou utiliser l'anglais par défaut
          const elevenLabsLanguage = languageMap[params.language] || 'en';
          console.log(`Langue ElevenLabs utilisée: ${elevenLabsLanguage}`);
          
          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': apiKey
            },
            body: JSON.stringify({
              text: cleanText,
              model_id: modelId,
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75
              }
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Erreur API ElevenLabs: ${response.status} ${response.statusText}`, errorText);
            
            // Si nous avons déjà généré au moins un segment audio, continuons avec ce que nous avons
            if (audioBuffers.length > 0) {
              console.log(`Erreur pour le dialogue ${i+1}, mais nous avons déjà ${audioBuffers.length} segments. Continuons avec ce que nous avons.`);
              break;
            }
            
            // Sinon, utiliser l'audio d'exemple
            console.warn(`Erreur pour le dialogue ${i+1} et aucun segment généré. Utilisation de l'audio d'exemple.`);
            return `/audio/sample-podcast.mp3?t=${Date.now()}`;
          }
          
          console.log(`Réponse reçue de l'API ElevenLabs pour le dialogue ${i+1}`);
          
          // Récupérer le buffer audio
          const buffer = Buffer.from(await response.arrayBuffer());
          console.log(`Audio généré pour le dialogue ${i+1}, taille: ${buffer.length} octets`);
          
          // Ajouter le buffer au tableau
          audioBuffers.push(buffer);
        } catch (dialogueError) {
          console.error(`Erreur lors de la génération audio pour le dialogue ${i+1}:`, dialogueError);
          
          // Si nous avons déjà généré au moins un segment audio, continuons avec ce que nous avons
          if (audioBuffers.length > 0) {
            console.log(`Erreur pour le dialogue ${i+1}, mais nous avons déjà ${audioBuffers.length} segments. Continuons avec ce que nous avons.`);
            break;
          }
          
          // Sinon, utiliser l'audio d'exemple
          console.warn(`Erreur pour le dialogue ${i+1} et aucun segment généré. Utilisation de l'audio d'exemple.`);
          return `/audio/sample-podcast.mp3?t=${Date.now()}`;
        }
      }
      
      // Vérifier si des buffers ont été générés
      if (audioBuffers.length === 0) {
        console.warn('Aucun audio n\'a pu être généré. Utilisation de l\'audio d\'exemple.');
        return `/audio/sample-podcast.mp3?t=${Date.now()}`;
      }
      
      // Combiner tous les buffers en un seul
      const combinedBuffer = Buffer.concat(audioBuffers);
      console.log(`Audio combiné, taille totale: ${combinedBuffer.length} octets`);
      
      // Écrire le fichier audio
      await writeFile(audioPath, combinedBuffer);
      
      console.log(`Audio généré avec succès: ${audioPath}`);
      return `/audio/${audioFilename}`;
      
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'API ElevenLabs:', error);
      console.warn('Utilisation de l\'audio d\'exemple suite à une erreur de connexion.');
      return `/audio/sample-podcast.mp3?t=${Date.now()}`;
    }
  } catch (error) {
    console.error('Erreur lors de la génération audio avec ElevenLabs:', error);
    return `/audio/sample-podcast.mp3?t=${Date.now()}`;
  }
}

// Fonction pour extraire les dialogues d'une transcription
function extractDialogues(transcript: string, params: GenerationParams): { speaker: string; text: string; voice: string }[] {
  console.log("Extraction des dialogues de la transcription...");
  console.log("Transcription brute:", transcript.substring(0, 200) + "...");
  
  // Nettoyer la transcription
  const cleanedTranscript = transcript
    .replace(/^#+\s+.*$/gm, '') // Supprimer les titres Markdown
    .replace(/^\*\*.*\*\*$/gm, '') // Supprimer les lignes en gras
    .replace(/^_.*_$/gm, '') // Supprimer les lignes soulignées
    .replace(/\s*[-*]\s+/gm, '') // Supprimer les listes à puces
    .replace(/\*\*.*?\*\*/g, '') // Supprimer le texte en gras
    .replace(/\*Tagline:.*?\*/g, '') // Supprimer la tagline
    .trim();
  
  console.log("Transcription nettoyée:", cleanedTranscript.substring(0, 200) + "...");
  
  // Tableau pour stocker les dialogues extraits
  const dialogues: { speaker: string; text: string; voice: string }[] = [];
  
  // Essayer différents formats de dialogue
  
  // Format 1: <Person1>Texte</Person1>
  // Utiliser une regex compatible avec les anciennes versions de JS
  const personRegex = /<(Person\d+|Présentateur|Expert)>([\s\S]*?)<\/\1>/g;
  let personMatch;
  let personMatches = [];
  
  while ((personMatch = personRegex.exec(cleanedTranscript)) !== null) {
    personMatches.push(personMatch);
  }
  
  if (personMatches.length > 0) {
    console.log("Dialogues trouvés au format <Person1>.");
    
    for (const match of personMatches) {
      const speaker = match[1];
      const text = match[2].trim();
      
      if (text) {
        const voice = speaker === "Person1" || speaker === params.firstSpeaker || speaker.includes("Présentateur") 
          ? params.firstSpeakerVoice 
          : params.secondSpeakerVoice;
        
        dialogues.push({ speaker, text, voice });
      }
    }
    
    return dialogues;
  }
  
  // Format 2: *Nom:* texte
  // Utiliser une regex compatible avec les anciennes versions de JS
  const nameColonRegex = /\*(.*?):\*([\s\S]*?)(?=\*.*?:\*|$)/g;
  let nameColonMatch;
  let nameColonMatches = [];
  
  while ((nameColonMatch = nameColonRegex.exec(cleanedTranscript)) !== null) {
    nameColonMatches.push(nameColonMatch);
  }
  
  if (nameColonMatches.length > 0) {
    console.log("Dialogues trouvés au format *Nom:* texte");
    
    for (const match of nameColonMatches) {
      const speaker = match[1].trim();
      const text = match[2].trim();
      
      if (text) {
        const voice = speaker.toLowerCase().includes(params.firstSpeaker.toLowerCase()) 
          ? params.firstSpeakerVoice 
          : params.secondSpeakerVoice;
        
        dialogues.push({ speaker, text, voice });
      }
    }
    
    return dialogues;
  }
  
  // Format 3: Nom: texte
  // Utiliser une regex compatible avec les anciennes versions de JS
  const simpleColonRegex = /(Présentateur|Expert|.*?):\s*([\s\S]*?)(?=(?:Présentateur|Expert|.*?):|$)/g;
  let simpleColonMatch;
  let simpleColonMatches = [];
  
  while ((simpleColonMatch = simpleColonRegex.exec(cleanedTranscript)) !== null) {
    simpleColonMatches.push(simpleColonMatch);
  }
  
  if (simpleColonMatches.length > 0) {
    console.log("Dialogues trouvés au format Nom: texte");
    
    for (const match of simpleColonMatches) {
      const speaker = match[1].trim();
      const text = match[2].trim();
      
      if (text) {
        const voice = speaker.toLowerCase().includes(params.firstSpeaker.toLowerCase()) 
          ? params.firstSpeakerVoice 
          : params.secondSpeakerVoice;
        
        dialogues.push({ speaker, text, voice });
      }
    }
    
    return dialogues;
  }
  
  // Format 4: *<Présentateur>Texte ou <Présentateur>Texte
  // Utiliser une regex compatible avec les anciennes versions de JS
  const taggedSpeakerRegex = /(?:\*)?<(Présentateur|Expert|.*?)>([\s\S]*?)(?=(?:\*)?<(?:Présentateur|Expert|.*?)>|$)/g;
  let taggedSpeakerMatch;
  let taggedSpeakerMatches = [];
  
  while ((taggedSpeakerMatch = taggedSpeakerRegex.exec(cleanedTranscript)) !== null) {
    taggedSpeakerMatches.push(taggedSpeakerMatch);
  }
  
  if (taggedSpeakerMatches.length > 0) {
    console.log("Dialogues trouvés au format <Présentateur>Texte");
    
    for (const match of taggedSpeakerMatches) {
      const speaker = match[1].trim();
      const text = match[2].trim();
      
      if (text) {
        const voice = speaker.toLowerCase().includes(params.firstSpeaker.toLowerCase()) 
          ? params.firstSpeakerVoice 
          : params.secondSpeakerVoice;
        
        dialogues.push({ speaker, text, voice });
      }
    }
    
    return dialogues;
  }
  
  // Si aucun format connu n'est trouvé, essayer de diviser par lignes
  console.log("Aucun dialogue trouvé dans les formats connus. Essai de division par lignes");
  
  // Diviser la transcription en lignes non vides
  const lines = cleanedTranscript
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // Alterner les intervenants pour chaque ligne
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Déterminer le locuteur en fonction de l'indice (pair/impair)
    const speaker = i % 2 === 0 ? params.firstSpeaker : params.secondSpeaker;
    const voice = i % 2 === 0 ? params.firstSpeakerVoice : params.secondSpeakerVoice;
    
    dialogues.push({ speaker, text: line, voice });
  }
  
  // Afficher les dialogues extraits
  console.log(`Dialogues extraits: ${dialogues.length}`);
  for (let i = 0; i < Math.min(3, dialogues.length); i++) {
    console.log(`Dialogue ${i+1}: ${dialogues[i].speaker} (${dialogues[i].voice}) - ${dialogues[i].text.substring(0, 50)}...`);
  }
  
  return dialogues;
}

// Fonction pour générer un podcast
async function generatePodcast(source: ContentSource, params: GenerationParams, apiConfig: ApiConfig) {
  try {
    console.log("Début de la génération du podcast...");
    
    // Étape 1: Génération de la transcription
    console.log("Étape 1: Génération de la transcription...");
    const transcript = await generateTranscript(source, params, apiConfig);
    
    // Étape 2: Génération de l'audio
    console.log("Étape 2: Génération de l'audio...");
    console.log("=== GÉNÉRATION AUDIO ===");
    const audioUrl = await generateAudio(transcript, params, apiConfig);
    
    console.log("Podcast généré avec succès!");
    console.log("URL audio:", audioUrl);
    
    return {
      success: true,
      audioUrl,
      transcript,
      error: null
    };
  } catch (error: any) {
    console.error("Erreur lors de la génération du podcast:", error);
    
    // Déterminer le type d'erreur pour un message plus précis
    let errorMessage = "Une erreur est survenue lors de la génération du podcast.";
    
    if (error.message) {
      if (error.message.includes("API key")) {
        errorMessage = "Clé API invalide ou manquante. Veuillez vérifier vos paramètres.";
      } else if (error.message.includes("quota") || error.message.includes("rate limit")) {
        errorMessage = "Quota API dépassé. Veuillez réessayer plus tard ou utiliser une autre clé API.";
      } else if (error.message.includes("network") || error.message.includes("timeout")) {
        errorMessage = "Erreur réseau. Veuillez vérifier votre connexion et réessayer.";
      } else {
        errorMessage = `Erreur: ${error.message}`;
      }
    }
    
    return {
      success: false,
      audioUrl: `/audio/sample-podcast.mp3?t=${Date.now()}`,
      transcript: "",
      error: errorMessage
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("Requête API reçue");
    
    // Récupérer les données de la requête
    const data = await request.json();
    const { source, params, apiConfig } = data;
    
    console.log("Données reçues:");
    console.log("- Source:", source ? source.type : "Non fournie");
    console.log("- Paramètres:", params ? "Fournis" : "Non fournis");
    console.log("- Configuration API:", apiConfig ? "Fournie" : "Non fournie");
    
    // Vérifier que les données nécessaires sont présentes
    if (!source || !params) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Données manquantes: source ou paramètres" 
        }, 
        { status: 400 }
      );
    }
    
    console.log("Début de la génération du podcast...");
    
    // Générer le podcast
    const result = await generatePodcast(source, params, apiConfig);
    
    // Retourner la réponse
    console.log("Réponse envoyée");
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error("Erreur lors du traitement de la requête:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Erreur serveur: ${error.message || "Erreur inconnue"}`,
        audioUrl: `/audio/sample-podcast.mp3?t=${Date.now()}`
      }, 
      { status: 500 }
    );
  }
} 