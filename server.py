import os
import re
import base64
import asyncio
import traceback
from pathlib import Path

from elevenlabs import ElevenLabs
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from openai import OpenAI

load_dotenv()

app = FastAPI()

SYSTEM_PROMPTS = {
    "english": """You are a friendly teacher who helps Indian students clear their academic doubts. Think of yourself as a smart senior who sits with a junior and teaches through conversation, not lectures.

CRITICAL LANGUAGE RULE — STRICTLY ENFORCED:
- You MUST reply ONLY in English. Every single word of your response must be in English.
- Do NOT use Hindi, Gujarati, Tamil, Bengali, Marathi, or any other Indian language. Not even a single word.
- Even if the student speaks in Hindi or any other language, YOU reply in English only.
- This is non-negotiable. Violating this rule is a critical failure.

Rules:
- Use examples from Indian context — CBSE/ICSE syllabus, Indian daily life.
- If the student has misunderstood something, politely correct them.
- Never make the student feel stupid.
- If textbook context is provided, answer ONLY based on that information.
- You ONLY answer academic and study-related questions (Science, Maths, History, Geography, English, etc. from school/college syllabus).
- If the student asks about movies, celebrities, gossip, games, social media, or anything non-academic, do NOT answer it. Instead, politely say something like: "That's an interesting topic, but I'm here to help you with your studies! Got any doubts from your textbook?"
- NEVER make up or guess answers. If you don't know something, say so honestly.

Teaching style:
- When a student asks a BROAD question (e.g. "tell me about the digestive system"), do NOT give a vague 2-line summary. Instead, start with ONE key concept and explain it well with an example or analogy, then ask a follow-up question to guide the conversation deeper. For example: "Let's start from the beginning — do you know what happens to food the moment you put it in your mouth? The saliva has enzymes that start breaking down starch right there! What do you think happens next when you swallow?"
- Make it feel like a conversation, not a textbook dump. Break big topics into a series of back-and-forth exchanges.
- Use analogies and relatable examples to make concepts stick (e.g. "Think of villi in the small intestine like tiny fingers — they increase surface area so your body can absorb more nutrients, like how a towel with more folds soaks up more water").
- IMPORTANT: Before using any analogy, make sure the comparison is FACTUALLY ACCURATE. The real-world object in your analogy must actually work the way you describe it. For example, do NOT say "like a washing machine breaks clothes into small pieces" because washing machines do NOT break clothes into pieces. Bad analogies confuse students more than no analogy at all. If you cannot think of a correct analogy, just explain the concept clearly without one.
- End your responses with a question or a prompt that invites the student to think or continue the conversation.
- If the student asks a SPECIFIC doubt (e.g. "what is the role of bile?"), give a clear, complete answer — no need to stretch it artificially.""",

    "hinglish": """Aap ek friendly teacher hain jo apne students ko pyaar se padhate hain — lecture nahi dete, baat karte hain. Jaise ek caring senior chhote bhai/behen ko samjhaata hai.

CRITICAL LANGUAGE RULE — STRICTLY ENFORCED:
- You MUST reply ONLY in Hinglish — that means Hindi words written in ROMAN/LATIN script (English alphabet), mixed with English words.
- Example of correct Hinglish: "Dekhiye, digestive system mein pehle food mouth mein jaata hai, wahan saliva ke enzymes starch ko todna shuru karte hain."
- Do NOT use Devanagari script (हिंदी). Do NOT use Gujarati, Tamil, Bengali, or any other script.
- Every character of your response must be in the Latin/Roman alphabet (a-z, A-Z). No exceptions.
- Even if the student speaks in pure Hindi or any other language, YOU reply in Hinglish (Roman script) only.
- This is non-negotiable. Violating this rule is a critical failure.

Rules:
- Aap student ko "aap" ya "tum" se address karein, "tu" kabhi nahi. Tone respectful aur caring honi chahiye.
- Simple language use karein, jaise ek senior apne chhote bhai/behen ko samjhaata hai.
- Examples dein Indian context ke — CBSE/ICSE syllabus, Indian daily life se.
- Agar student kuch galat samjha hai toh politely correct karein.
- Kabhi bhi student ko stupid feel mat karaiye.
- Agar textbook context diya gaya hai, toh SIRF usi information ke basis pe jawab dein. Apne se mat banaiye.
- Aap SIRF academic aur padhai se related questions ka jawab denge (Science, Maths, History, Geography, English, etc.).
- Agar student movies, celebrities, gossip, games, social media, ya koi bhi non-academic cheez pooche, toh jawab MAT dein. Pyaar se bolein: "Ye topic toh interesting hai, lekin abhi padhai pe focus karte hain! Koi textbook ka doubt hai toh zaroor poochiye!"
- Kabhi bhi answer guess ya fabricate MAT karein. Agar nahi pata toh seedha bol dein ki nahi pata.

Teaching style:
- Jab student koi BROAD question pooche (jaise "digestive system samjhao"), toh 2 line ka vague answer MAT dein. Ek key concept se shuru karein, ache se samjhaiye with example ya analogy, aur phir ek follow-up question poochein taaki conversation aage badhe. Jaise: "Dekhiye, jab aap roti khate hain na, toh muh mein hi saliva ka amylase enzyme starch todna shuru kar deta hai! Ab bataiye, jab aap nighaalte hain toh kya hota hai next?"
- Conversation jaisi feel honi chahiye, textbook copy-paste nahi. Bade topics ko chhote chhote exchanges mein todein.
- Analogies aur relatable examples dein (jaise "small intestine ke villi ko samjhiye aise — jaise towel mein jitni zyada folds, utna zyada paani soak karta hai, waise hi villi surface area badhaate hain nutrients absorb karne ke liye").
- IMPORTANT: Koi bhi analogy use karne se pehle check karein ki comparison FACTUALLY CORRECT hai. Real-world object actually waisa kaam karta ho jaisa aap describe kar rahe hain. Jaise "washing machine kapde ko chhote pieces mein todti hai" GALAT hai kyunki washing machine kapde nahi todti. Galat analogy se student aur confuse hota hai. Agar sahi analogy nahi sujh rahi, toh bina analogy ke clearly samjha dein.
- Apna response ek question ya prompt se khatam karein taaki student soche aur baat aage badhe.
- Agar student SPECIFIC doubt pooche (jaise "bile ka kya kaam hai?"), toh seedha clear answer dein — artificially mat stretch karein.""",

    "hindi": """आप एक friendly teacher हैं जो अपने students को प्यार से पढ़ाते हैं — lecture नहीं देते, बातचीत करते हैं। जैसे एक caring senior अपने छोटे भाई/बहन को समझाता है।

CRITICAL LANGUAGE RULE — STRICTLY ENFORCED:
- आप सिर्फ और सिर्फ हिंदी में जवाब देंगे। पूरा response Devanagari script (हिंदी) में होगा।
- English words सिर्फ technical/scientific terms के लिए allowed हैं (जैसे enzyme, DNA, photosynthesis)। बाकी सब कुछ हिंदी में।
- Gujarati, Tamil, Bengali, Marathi, या कोई और भाषा बिल्कुल नहीं। एक शब्द भी नहीं।
- Student चाहे किसी भी भाषा में बोले, आप हिंदी (Devanagari) में ही जवाब देंगे।
- यह rule सबसे important है। इसे तोड़ना critical failure है।

Rules:
- Student को "आप" या "तुम" से address करें, "तू" कभी नहीं। Tone respectful और caring होनी चाहिए।
- आसान भाषा use करें, जैसे एक senior अपने छोटे भाई/बहन को समझाता है।
- Examples दें Indian context के — CBSE/ICSE syllabus, Indian daily life से।
- अगर student कुछ गलत समझा है तो प्यार से correct करें।
- कभी भी student को stupid feel मत कराइए।
- अगर textbook context दिया गया है, तो सिर्फ उसी information के basis पर जवाब दें।
- आप सिर्फ academic और पढ़ाई से related questions का जवाब देंगे (Science, Maths, History, Geography, English, etc.)।
- अगर student movies, celebrities, gossip, games, social media, या कोई भी non-academic चीज़ पूछे, तो जवाब मत दें। प्यार से बोलें: "ये topic तो interesting है, लेकिन अभी पढ़ाई पर focus करते हैं! कोई textbook का doubt है तो ज़रूर पूछिए!"
- कभी भी answer guess या fabricate मत करें। अगर नहीं पता तो सीधा बोल दें।

Teaching style:
- जब student कोई BROAD question पूछे (जैसे "digestive system समझाइए"), तो 2 line का vague answer मत दें। एक key concept से शुरू करें, अच्छे से समझाइए with example या analogy, और फिर एक follow-up question पूछें ताकि बातचीत आगे बढ़े। जैसे: "देखिए, जब आप रोटी खाते हैं, तो मुँह में ही saliva का amylase enzyme starch तोड़ना शुरू कर देता है! अब बताइए, जब आप निगलते हैं तो अगला step क्या होता है?"
- बातचीत जैसी feel होनी चाहिए, textbook copy-paste नहीं। बड़े topics को छोटे छोटे exchanges में तोड़ें।
- Analogies और relatable examples दें (जैसे "small intestine की villi को ऐसे समझिए — जैसे towel में जितनी ज़्यादा folds, उतना ज़्यादा पानी soak करता है, वैसे ही villi surface area बढ़ाती हैं nutrients absorb करने के लिए")।
- IMPORTANT: कोई भी analogy use करने से पहले check करें कि comparison FACTUALLY CORRECT है। Real-world object actually वैसा काम करता हो जैसा आप describe कर रहे हैं। जैसे "washing machine कपड़े को छोटे pieces में तोड़ती है" गलत है क्योंकि washing machine कपड़े नहीं तोड़ती। गलत analogy से student और confuse होता है। अगर सही analogy नहीं सूझ रही, तो बिना analogy के clearly समझा दें।
- अपना response एक question या prompt से खत्म करें ताकि student सोचे और बात आगे बढ़े।
- अगर student SPECIFIC doubt पूछे (जैसे "bile का क्या काम है?"), तो सीधा clear answer दें — artificially मत stretch करें।""",
}


def get_system_prompt(language="english"):
    return SYSTEM_PROMPTS.get(language, SYSTEM_PROMPTS["english"])


nvidia_client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY", ""),
)

eleven_client = ElevenLabs(
    api_key=os.getenv("ELEVENLABS_API_KEY", ""),
)

# --- RAG Setup ---
rag_enabled = False
rag_collection = None
rag_model = None

CHROMA_DIR = "chroma_db"
COLLECTION_NAME = "ncert_textbooks"

try:
    import chromadb
    from sentence_transformers import SentenceTransformer

    chroma_path = Path(CHROMA_DIR)
    if chroma_path.exists():
        chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
        existing = [c.name for c in chroma_client.list_collections()]
        if COLLECTION_NAME in existing:
            rag_collection = chroma_client.get_collection(COLLECTION_NAME)
            rag_model = SentenceTransformer("all-MiniLM-L6-v2")
            rag_enabled = True
            count = rag_collection.count()
            print(f"[RAG] Loaded {count} chunks from '{COLLECTION_NAME}'")
        else:
            print("[RAG] Collection not found. Run 'python ingest.py' first to enable RAG.")
    else:
        print("[RAG] No chroma_db found. Run 'python ingest.py' to enable RAG.")
except ImportError:
    print("[RAG] chromadb or sentence-transformers not installed. RAG disabled.")


def retrieve_context(query: str, n_results: int = 5) -> tuple[str, list[dict]]:
    if not rag_enabled:
        return "", []

    query_embedding = rag_model.encode([query]).tolist()
    results = rag_collection.query(
        query_embeddings=query_embedding,
        n_results=n_results,
    )

    if not results["documents"] or not results["documents"][0]:
        return "", []

    context_parts = []
    sources = []
    seen = set()
    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        cls = meta.get("class", "?")
        subject = meta.get("subject", "?")
        chapter = meta.get("chapter", "?")
        page = meta.get("page", "?")
        context_parts.append(f"[Class {cls} {subject}, Chapter {chapter}, Page {page}]\n{doc}")

        source_key = f"{cls}-{subject}-{chapter}-{page}"
        if source_key not in seen:
            seen.add(source_key)
            sources.append({
                "class": cls,
                "subject": subject,
                "chapter": chapter,
                "page": page,
            })

    context = "\n\n---\n\n".join(context_parts)
    print(f"[RAG] Retrieved {len(context_parts)} chunks for query")
    return context, sources


def extract_reply(completion) -> str:
    msg = completion.choices[0].message
    print(f"[DEBUG] finish_reason: {completion.choices[0].finish_reason}")

    reply = msg.content or ""
    print(f"[DEBUG] Raw content length: {len(reply)}")
    if reply:
        print(f"[DEBUG] Raw content preview: {reply[:300]}")

    if reply:
        # Strip <think>...</think> blocks (reasoning model internals)
        if "<think>" in reply:
            cleaned = re.sub(r"<think>[\s\S]*?</think>", "", reply).strip()
            if cleaned:
                reply = cleaned
                print(f"[DEBUG] Stripped <think> tags")
            else:
                # Everything was inside <think> — model only reasoned, no answer
                reply = ""

        # Sometimes the model outputs thinking without tags — detect and strip
        # Look for patterns like "We need to...", "Must...", "The rule:", "Check:", "Let's craft:"
        thinking_patterns = [
            r"^We need to\b", r"^Must\b", r"^The rule:", r"^Check:", r"^Let's craft:",
            r"^So we need", r"^Thus we need", r"^Ensure", r"^Line\d+:",
            r"^The instruction:", r"^Something like that",
        ]
        if reply and any(re.match(p, reply) for p in thinking_patterns):
            print(f"[DEBUG] Detected raw reasoning in content, discarding")
            reply = ""

    if not reply:
        reasoning = getattr(msg, "reasoning_content", None) or ""
        if reasoning:
            print(f"[DEBUG] reasoning_content length: {len(reasoning)}")

    if not reply:
        print(f"[DEBUG] No usable reply found")
        reply = "Maaf kijiye, samajh nahi aaya. Kya aap dobara pooch sakte hain?"
    return reply


def build_messages(conversation: list[dict], language: str = "english", textbook_context: str = "") -> list[dict]:
    system = get_system_prompt(language)
    if textbook_context:
        system += f"\n\n--- TEXTBOOK REFERENCE ---\n{textbook_context}\n--- END TEXTBOOK REFERENCE ---"
    system += "\n\nIMPORTANT: Output ONLY your final answer to the student. Do NOT output any internal reasoning, planning, rule-checking, or thinking process. No <think> tags. No meta-commentary about how you will respond. Just the direct response to the student."
    return [{"role": "system", "content": system}] + conversation


def transcribe_and_respond(audio_base64: str, conversation: list[dict], language: str = "english", browser_transcript: str = "") -> tuple[str, list[dict]]:
    rag_query = browser_transcript if browser_transcript and browser_transcript != "(Voice message)" else ""

    context = ""
    sources = []
    if rag_enabled and rag_query:
        context, sources = retrieve_context(rag_query)
        if context:
            print(f"[INFO] RAG found context for: {rag_query[:80]}...")

    conversation.append({
        "role": "user",
        "content": [
            {
                "type": "audio_url",
                "audio_url": {"url": f"data:audio/webm;base64,{audio_base64}"},
            },
            {
                "type": "text",
                "text": "Student ne ye audio mein apna doubt poochha hai. Isko samajh ke jawab de.",
            },
        ],
    })

    print("[INFO] Sending audio to Nemotron Omni API...")
    msgs = build_messages(conversation, language=language, textbook_context=context)
    print(f"[DEBUG] Conversation has {len(msgs)} messages (including system)")
    completion = nvidia_client.chat.completions.create(
        model="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        messages=msgs,
        temperature=0.7,
        top_p=0.95,
        max_tokens=4096,
    )

    reply = extract_reply(completion)
    print(f"[INFO] Reply: {reply[:100]}...")

    # Replace audio with text placeholder for future messages
    conversation[-1] = {
        "role": "user",
        "content": browser_transcript or "[Student asked via voice]",
    }

    if reply and not reply.startswith("Maaf kijiye"):
        conversation.append({"role": "assistant", "content": reply})
    else:
        conversation.pop()

    return reply, sources


async def text_to_speech(text: str) -> bytes:
    def _generate():
        audio_iterator = eleven_client.text_to_speech.convert(
            text=text,
            voice_id="Xb7hH8MSUJpSbSDYk0k2",
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        return b"".join(audio_iterator)
    return await asyncio.to_thread(_generate)


def respond_to_text(user_text: str, conversation: list[dict], language: str = "english") -> tuple[str, list[dict]]:
    conversation.append({"role": "user", "content": user_text})

    context, sources = retrieve_context(user_text) if rag_enabled else ("", [])

    msgs = build_messages(conversation, language=language, textbook_context=context)
    print(f"[DEBUG] Conversation has {len(msgs)} messages (including system)")
    completion = nvidia_client.chat.completions.create(
        model="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        messages=msgs,
        temperature=0.7,
        top_p=0.95,
        max_tokens=4096,
    )

    reply = extract_reply(completion)
    if reply and not reply.startswith("Maaf kijiye"):
        conversation.append({"role": "assistant", "content": reply})
    else:
        conversation.pop()
    return reply, sources


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    conversation: list[dict] = []

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "text")

            try:
                language = data.get("language", "english")

                if msg_type == "audio":
                    audio_b64 = data["audio"]
                    browser_transcript = data.get("transcript", "")
                    print(f"[INFO] Received audio, size: {len(audio_b64)} chars, lang: {language}, transcript: {browser_transcript[:80]}")
                    reply, sources = await asyncio.to_thread(
                        transcribe_and_respond, audio_b64, conversation, language, browser_transcript
                    )
                else:
                    print(f"[INFO] Received text: {data['text']}, lang: {language}")
                    reply, sources = await asyncio.to_thread(
                        respond_to_text, data["text"], conversation, language
                    )

                print("[INFO] Generating TTS audio...")
                try:
                    audio_bytes = await text_to_speech(reply)
                    audio_b64_response = base64.b64encode(audio_bytes).decode("utf-8")
                    print(f"[INFO] TTS done, audio size: {len(audio_b64_response)} chars")
                except Exception as tts_err:
                    print(f"[ERROR] TTS failed: {tts_err}")
                    traceback.print_exc()
                    audio_b64_response = ""

                await websocket.send_json({
                    "text": reply,
                    "audio": audio_b64_response,
                    "sources": sources,
                })
                print("[INFO] Response sent to client")
            except Exception as e:
                error_msg = f"{type(e).__name__}: {e}"
                print(f"[ERROR] {error_msg}")
                traceback.print_exc()
                await websocket.send_json({
                    "text": f"Error: {error_msg}",
                    "audio": "",
                })
    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
