import struct
import os

def get_jpeg_size(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    i = 0
    while i < len(data):
        if data[i] == 0xFF:
            marker = data[i+1]
            if marker in (0xC0, 0xC2):
                h, w = struct.unpack('>HH', data[i+5:i+9])
                return w, h
            elif marker not in (0xD8, 0xD9):
                length = struct.unpack('>H', data[i+2:i+4])[0]
                i += 2 + length
                continue
        i += 1
    return 1376, 768

class SlideDeckPDF:
    def __init__(self, width=960, height=540):
        self.width = width
        self.height = height
        self.objects = []
        self.pages = []
        self.image_obj_id = None
        
    def add_jpeg_image(self, filepath):
        w, h = get_jpeg_size(filepath)
        with open(filepath, 'rb') as f:
            jpeg_bytes = f.read()
            
        header = f'''<<
  /Type /XObject
  /Subtype /Image
  /Width {w}
  /Height {h}
  /ColorSpace /DeviceRGB
  /BitsPerComponent 8
  /Filter /DCTDecode
  /Length {len(jpeg_bytes)}
>>\nstream\n'''.encode('latin1')
        footer = b'\nendstream'
        obj_bytes = header + jpeg_bytes + footer
        
        self.objects.append(obj_bytes)
        self.image_obj_id = len(self.objects) + 2
        return self.image_obj_id
        
    def add_slide(self, stream_commands, uses_image=False):
        if isinstance(stream_commands, str):
            stream_bytes = stream_commands.encode('latin1')
        else:
            stream_bytes = stream_commands
            
        page_idx = len(self.objects) + 3
        content_idx = len(self.objects) + 4
        self.pages.append(page_idx)
        
        xobject_entry = f'/Im1 {self.image_obj_id} 0 R' if (uses_image and self.image_obj_id) else ''
        
        page_obj = f'''<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 {self.width} {self.height}]
  /Resources <<
    /Font <<
      /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
      /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
      /F3 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>
    >>
    /XObject << {xobject_entry} >>
  >>
  /Contents {content_idx} 0 R
>>'''
        self.objects.append(page_obj)
        
        content_obj = f'''<<
  /Length {len(stream_bytes)}
>>
stream
{stream_commands}
endstream'''
        self.objects.append(content_obj)
        
    def compile(self):
        catalog = '<< /Type /Catalog /Pages 2 0 R >>'
        kids = ' '.join(f'{p} 0 R' for p in self.pages)
        pages_node = f'<< /Type /Pages /Kids [{kids}] /Count {len(self.pages)} >>'
        
        all_objs = [catalog, pages_node] + self.objects
        
        out = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
        offsets = [0]
        
        for i, obj in enumerate(all_objs, 1):
            offsets.append(len(out))
            if isinstance(obj, str):
                obj_bytes = obj.encode('latin1')
            else:
                obj_bytes = obj
            out += f'{i} 0 obj\n'.encode('latin1') + obj_bytes + b'\nendobj\n'
            
        xref_offset = len(out)
        out += f'xref\n0 {len(all_objs) + 1}\n0000000000 65535 f \n'.encode('latin1')
        for off in offsets[1:]:
            out += f'{off:010d} 00000 n \n'.encode('latin1')
            
        out += f'trailer\n<< /Size {len(all_objs) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n'.encode('latin1')
        return out

def build_presentation(output_pdf_path='NovaFuse_Slide_Presentation.pdf'):
    pdf = SlideDeckPDF()
    
    # Embed cover image if it exists
    cover_path = 'novafuse_cover.jpg'
    has_image = False
    if os.path.exists(cover_path):
        pdf.add_jpeg_image(cover_path)
        has_image = True
        
    # Helper to escape pdf text
    def esc(text):
        return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
        
    # ---------------- SLIDE 1: Title Slide with Embedded Cover Visual ----------------
    slide1 = f'''
0.04 0.05 0.08 rg 0 0 960 540 re f
q 500 0 0 280 430 130 cm /Im1 Do Q
0.55 0.3 0.95 rg 60 480 320 3 re f
BT /F1 11 Tf 0.25 0.85 0.95 rg 60 450 Td (HACKATHON SUBMISSION  |  VOICE AI & EDTECH) Tj ET
BT /F1 38 Tf 1 1 1 rg 60 395 Td (NOVAFUSE) Tj ET
BT /F1 18 Tf 0.8 0.85 1 rg 60 360 Td (Voice-First AI Study & STAR Interview Agent) Tj ET
BT /F2 13 Tf 0.65 0.7 0.8 rg 60 310 Td (Transforming passive study habits into high-retention,) Tj ET
BT /F2 13 Tf 0.65 0.7 0.8 rg 60 290 Td (real-time spoken dialogue with adaptive evaluation.) Tj ET
0.1 0.13 0.22 rg 60 180 340 70 re f
BT /F1 11 Tf 0.25 0.85 0.95 rg 75 225 Td (KEY FEATURES) Tj ET
BT /F2 10 Tf 0.85 0.9 0.95 rg 75 205 Td (- Socratic Active Recall Revision Mode) Tj ET
BT /F1 10 Tf 0.25 0.85 0.95 rg 60 75 Td (Live App: https://www.novafuse.site/dashboard) Tj ET
BT /F2 10 Tf 0.5 0.55 0.65 rg 60 55 Td (Presenter: Sahil Rawat  |  Powered by AssemblyAI & WebSockets) Tj ET
''' if has_image else '''
0.04 0.05 0.08 rg 0 0 960 540 re f
0.55 0.3 0.95 rg 60 480 840 4 re f
BT /F1 12 Tf 0.25 0.85 0.95 rg 60 440 Td (HACKATHON SUBMISSION  |  VOICE AI & EDTECH) Tj ET
BT /F1 44 Tf 1 1 1 rg 60 375 Td (NOVAFUSE) Tj ET
BT /F1 22 Tf 0.8 0.85 1 rg 60 335 Td (Voice-First AI Study & STAR Interview Agent) Tj ET
BT /F2 15 Tf 0.7 0.75 0.85 rg 60 270 Td (Transforming passive study habits into high-retention spoken dialogue.) Tj ET
'''
    pdf.add_slide(slide1, uses_image=has_image)

    # ---------------- SLIDE 2: The Problem ----------------
    slide2 = '''
0.04 0.05 0.08 rg 0 0 960 540 re f
0.95 0.3 0.35 rg 60 490 180 3 re f
BT /F1 11 Tf 0.95 0.35 0.4 rg 60 465 Td (THE PROBLEM) Tj ET
BT /F1 26 Tf 1 1 1 rg 60 430 Td (Silent Reading Creates an Illusion of Competence) Tj ET
BT /F2 13 Tf 0.7 0.75 0.85 rg 60 405 Td (Traditional learning platforms test recognition, not verbal recall under pressure.) Tj ET

0.08 0.1 0.16 rg 60 120 260 250 re f
0.15 0.75 0.95 rg 60 367 260 3 re f
BT /F1 14 Tf 1 1 1 rg 80 335 Td (Passive Recognition) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 80 290 Td (Students re-read notes and click) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 80 272 Td (multiple-choice buttons, which) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 80 254 Td (tests visual cues rather than) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 80 236 Td (deep mental synthesis.) Tj ET
BT /F2 11 Tf 0.95 0.5 0.5 rg 80 180 Td (Result: Knowledge collapses) Tj ET
BT /F2 11 Tf 0.95 0.5 0.5 rg 80 162 Td (during spoken exams.) Tj ET

0.08 0.1 0.16 rg 350 120 260 250 re f
0.65 0.35 0.95 rg 350 367 260 3 re f
BT /F1 14 Tf 1 1 1 rg 370 335 Td (Verbal Articulation Gap) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 370 290 Td (Spoken explanation engages) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 370 272 Td (separate neurological circuits:) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 370 254 Td (pacing, real-time structuring,) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 370 236 Td (and technical vocabulary.) Tj ET
BT /F2 11 Tf 0.95 0.5 0.5 rg 370 180 Td (Result: High anxiety &) Tj ET
BT /F2 11 Tf 0.95 0.5 0.5 rg 370 162 Td (hesitation in real interviews.) Tj ET

0.08 0.1 0.16 rg 640 120 260 250 re f
0.95 0.7 0.2 rg 640 367 260 3 re f
BT /F1 14 Tf 1 1 1 rg 660 335 Td (Coaching Bottlenecks) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 660 290 Td (Human mock interviewers) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 660 272 Td (and viva tutors cost \\$100+/hr,) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 660 254 Td (require scheduling across) Tj ET
BT /F2 11 Tf 0.75 0.8 0.9 rg 660 236 Td (zones, and induce peer fear.) Tj ET
BT /F2 11 Tf 0.95 0.5 0.5 rg 660 180 Td (Result: Practice happens) Tj ET
BT /F2 11 Tf 0.95 0.5 0.5 rg 660 162 Td (too late or not at all.) Tj ET

BT /F2 10 Tf 0.5 0.55 0.65 rg 60 50 Td (NovaFuse  |  Slide 2) Tj ET
'''
    pdf.add_slide(slide2)

    # ---------------- SLIDE 3: The Solution ----------------
    slide3 = '''
0.04 0.05 0.08 rg 0 0 960 540 re f
0.2 0.85 0.5 rg 60 490 180 3 re f
BT /F1 11 Tf 0.25 0.85 0.5 rg 60 465 Td (THE SOLUTION) Tj ET
BT /F1 26 Tf 1 1 1 rg 60 430 Td (NovaFuse: Your Autonomous AI Spoken Dialogue Partner) Tj ET
BT /F2 13 Tf 0.7 0.75 0.85 rg 60 405 Td (A voice-first agent running full-duplex spoken dialogues with adaptive memory.) Tj ET

0.08 0.12 0.2 rg 60 120 400 250 re f
0.15 0.75 0.95 rg 60 367 400 3 re f
BT /F1 16 Tf 0.25 0.85 0.95 rg 80 335 Td (1. Active Recall Revision Mode) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 80 295 Td (- Socratic inquiry: Quizzes concepts, probes deeper on vague answers) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 80 270 Td (- Real-time pacing: Adapts difficulty dynamically on streaks) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 80 245 Td (- Instant remediation: Breaks down complex topics into analogies) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 80 220 Td (- Function calling: Evaluates answer quality in real-time) Tj ET
BT /F1 11 Tf 0.2 0.85 0.5 rg 80 160 Td (Target: University students, viva prep, medical licensing) Tj ET

0.08 0.12 0.2 rg 500 120 400 250 re f
0.65 0.35 0.95 rg 500 367 400 3 re f
BT /F1 16 Tf 0.75 0.45 1 rg 520 335 Td (2. STAR Mock Interview Studio) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 520 295 Td (- Strict STAR enforcement: Situation, Task, Action, Result) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 520 270 Td (- Technical role calibration: SWE, System Design, Product Leads) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 520 245 Td (- Probing follow-ups: Pushes on metrics, architecture trade-offs) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 520 220 Td (- Comprehensive rubric: Delivers structured hire recommendation) Tj ET
BT /F1 11 Tf 0.2 0.85 0.5 rg 520 160 Td (Target: Software engineers, job seekers, behavioral loops) Tj ET

BT /F2 10 Tf 0.5 0.55 0.65 rg 60 50 Td (NovaFuse  |  Slide 3) Tj ET
'''
    pdf.add_slide(slide3)

    # ---------------- SLIDE 4: Architecture ----------------
    slide4 = '''
0.04 0.05 0.08 rg 0 0 960 540 re f
0.25 0.75 0.95 rg 60 490 180 3 re f
BT /F1 11 Tf 0.25 0.85 0.95 rg 60 465 Td (TECHNICAL ARCHITECTURE) Tj ET
BT /F1 26 Tf 1 1 1 rg 60 430 Td (Sub-Second Latency Full-Duplex Audio Pipeline) Tj ET
BT /F2 13 Tf 0.7 0.75 0.85 rg 60 405 Td (Built with browser AudioWorklets, Node.js WebSocket relay, and AssemblyAI.) Tj ET

0.08 0.1 0.16 rg 60 120 200 250 re f
0.15 0.75 0.95 rg 60 367 200 3 re f
BT /F1 13 Tf 1 1 1 rg 75 335 Td (1. AudioWorklet) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 75 290 Td (Captures microphone) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 75 272 Td (audio off main thread.) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 75 250 Td (Resamples to 24kHz) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 75 232 Td (PCM16 mono audio) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 75 214 Td (with zero jitter.) Tj ET
BT /F1 10 Tf 0.25 0.85 0.95 rg 75 160 Td (Web Audio API) Tj ET

0.08 0.1 0.16 rg 285 120 200 250 re f
0.5 0.4 0.95 rg 285 367 200 3 re f
BT /F1 13 Tf 1 1 1 rg 300 335 Td (2. WebSocket Relay) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 300 290 Td (Node.js/ws proxy) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 300 272 Td (protects secret keys.) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 300 250 Td (Relays binary PCM) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 300 232 Td (and JSON events) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 300 214 Td (with 30s reconnect.) Tj ET
BT /F1 10 Tf 0.65 0.45 1 rg 300 160 Td (Node.js + Express) Tj ET

0.08 0.1 0.16 rg 510 120 200 250 re f
0.9 0.35 0.7 rg 510 367 200 3 re f
BT /F1 13 Tf 1 1 1 rg 525 335 Td (3. AssemblyAI Agent) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 525 290 Td (Unified WebSocket:) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 525 272 Td (STT + LLM + TTS.) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 525 250 Td (Neural turn detection) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 525 232 Td (and barge-in voice) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 525 214 Td (interruption support.) Tj ET
BT /F1 10 Tf 0.95 0.45 0.75 rg 525 160 Td (AssemblyAI Voice API) Tj ET

0.08 0.1 0.16 rg 735 120 165 250 re f
0.2 0.85 0.5 rg 735 367 165 3 re f
BT /F1 13 Tf 1 1 1 rg 750 335 Td (4. Data Layer) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 750 290 Td (PostgreSQL &) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 750 272 Td (Prisma ORM.) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 750 250 Td (Self-healing DDL) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 750 232 Td (auto-migration on) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 750 214 Td (server boot.) Tj ET
BT /F1 10 Tf 0.2 0.85 0.5 rg 750 160 Td (Prisma + Postgres) Tj ET

BT /F2 10 Tf 0.5 0.55 0.65 rg 60 50 Td (NovaFuse  |  Slide 4) Tj ET
'''
    pdf.add_slide(slide4)

    # ---------------- SLIDE 5: Key Innovation ----------------
    slide5 = '''
0.04 0.05 0.08 rg 0 0 960 540 re f
0.65 0.35 0.95 rg 60 490 180 3 re f
BT /F1 11 Tf 0.75 0.45 1 rg 60 465 Td (KEY INNOVATION) Tj ET
BT /F1 26 Tf 1 1 1 rg 60 430 Td (Continuous Memory: The Weak-Topic Injection Loop) Tj ET
BT /F2 13 Tf 0.7 0.75 0.85 rg 60 405 Td (Autonomous spaced repetition powered by real-time function calling.) Tj ET

0.08 0.12 0.2 rg 60 210 260 160 re f
BT /F1 13 Tf 0.25 0.85 0.95 rg 80 335 Td (1. In-Call Evaluation) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 80 300 Td (Agent triggers log_answer_quality) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 80 282 Td (while talking. Stores status) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 80 264 Td ((strong/partial/weak) & clinical) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 80 246 Td (misconception notes.) Tj ET

0.08 0.12 0.2 rg 350 210 260 160 re f
BT /F1 13 Tf 0.65 0.45 1 rg 370 335 Td (2. Spaced Extraction) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 370 300 Td (When the student starts a new) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 370 282 Td (session, historical weak topics) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 370 264 Td (are automatically queried and) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 370 246 Td (ranked by urgency.) Tj ET

0.08 0.12 0.2 rg 640 210 260 160 re f
BT /F1 13 Tf 0.2 0.85 0.5 rg 660 335 Td (3. Adaptive Prompt) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 660 300 Td (System prompt instructs agent) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 660 282 Td (to naturally re-examine weak) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 660 264 Td (points without making the) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 660 246 Td (learner feel discouraged.) Tj ET

0.07 0.09 0.15 rg 60 100 840 80 re f
BT /F1 11 Tf 0.95 0.8 0.25 rg 80 150 Td (TRANSPARENT UNIT ECONOMICS) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 80 130 Td (Calculates exact session duration and API cost at \\$0.075/min.) Tj ET
BT /F2 10 Tf 0.8 0.85 0.95 rg 80 115 Td (Full transparency for both individual learners and educational institutions.) Tj ET

BT /F2 10 Tf 0.5 0.55 0.65 rg 60 50 Td (NovaFuse  |  Slide 5) Tj ET
'''
    pdf.add_slide(slide5)

    # ---------------- SLIDE 6: Accomplishments & Roadmap ----------------
    slide6 = '''
0.04 0.05 0.08 rg 0 0 960 540 re f
0.2 0.85 0.5 rg 60 490 180 3 re f
BT /F1 11 Tf 0.2 0.85 0.5 rg 60 465 Td (RESULTS & ROADMAP) Tj ET
BT /F1 26 Tf 1 1 1 rg 60 430 Td (Shipped, Live & Verified in Production) Tj ET
BT /F2 13 Tf 0.7 0.75 0.85 rg 60 405 Td (Deployed on Render with 40/40 passing integration tests.) Tj ET

0.08 0.12 0.2 rg 60 120 400 250 re f
0.2 0.85 0.5 rg 60 367 400 3 re f
BT /F1 16 Tf 0.2 0.85 0.5 rg 80 335 Td (What We Accomplished) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 80 295 Td (- Real-time full-duplex spoken conversation in browser) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 80 270 Td (- Barge-in interruptions & neural semantic turn-taking) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 80 245 Td (- Dual Socratic Revision + STAR Interview evaluation) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 80 220 Td (- Self-healing PostgreSQL schema bootstrapping on boot) Tj ET
BT /F1 11 Tf 0.25 0.85 0.95 rg 80 150 Td (Live App: https://www.novafuse.site/dashboard) Tj ET

0.08 0.12 0.2 rg 500 120 400 250 re f
0.65 0.35 0.95 rg 500 367 400 3 re f
BT /F1 16 Tf 0.75 0.45 1 rg 520 335 Td (What is Next for NovaFuse) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 520 295 Td (- Multi-agent panel interviews (e.g. Hiring Manager + Tech Lead)) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 520 270 Td (- Computer vision analysis for eye contact and body poise) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 520 245 Td (- Native Anki & Notion sync for weak-topic flashcards) Tj ET
BT /F2 11 Tf 0.8 0.85 0.95 rg 520 220 Td (- Multi-language oral proficiency exam simulation) Tj ET
BT /F1 11 Tf 0.2 0.85 0.5 rg 520 150 Td (NovaFuse: Master Knowledge Through Spoken Voice) Tj ET

BT /F2 10 Tf 0.5 0.55 0.65 rg 60 50 Td (NovaFuse  |  Slide 6) Tj ET
'''
    pdf.add_slide(slide6)

    compiled = pdf.compile()
    with open(output_pdf_path, 'wb') as f:
        f.write(compiled)
    print(f'Successfully built {output_pdf_path} ({len(compiled)} bytes, 6 slides)')

if __name__ == '__main__':
    build_presentation()
