import asyncio
import os
import subprocess
import tempfile
from edge_tts import Communicate

# Voces seleccionadas
VOICE_DOCTOR = "es-MX-JorgeNeural"
VOICE_PATIENT = "es-CO-SalomeNeural"

# Diálogo
SCRIPT = [
    {"voice": VOICE_DOCTOR, "text": "Señora María Elena, los exámenes muestran que su hipertensión y su diabetes tipo dos ya están completamente estabilizadas."},
    {"voice": VOICE_PATIENT, "text": "Ay, qué alivio, doctor... ¿Entonces ya me puedo ir para mi casa?"},
    {"voice": VOICE_DOCTOR, "text": "Sí, le daremos el alta hoy mismo para que descanse. Siga la dieta estricta."},
    {"voice": VOICE_DOCTOR, "text": "MediLink, guarda una nota en FHIR indicando que la paciente está estable y sin riesgo agudo. Luego, programa su alta médica en mi Google Calendar. Al terminar, lee su historial para confirmarme que la nota quedó guardada.", "pause_before": 1.0}
]

async def generate_segment(text, voice, filename):
    communicate = Communicate(text, voice)
    await communicate.save(filename)

async def main():
    parts = []
    
    with tempfile.TemporaryDirectory() as tmpdir:
        for i, entry in enumerate(SCRIPT):
            tmp_file = os.path.join(tmpdir, f"part_{i}.mp3")
            print(f"Generando parte {i} ({entry['voice']})...")
            await generate_segment(entry['text'], entry['voice'], tmp_file)
            parts.append(tmp_file)

        output_path = "/Users/jesusandresmezacontreras/projects/AegisHealth/public/audio_demo.mp3"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Construir comando ffmpeg para concatenar con pausas
        # [0:a][1:a]... concat=n=4:v=0:a=1 [out]
        # Para pausas, podríamos generar archivos de silencio o usar adelays en filter_complex
        
        # Opción simple: Concatenar archivos directamente. 
        # Para las pausas agregaremos un pequeño adelay en el filtro
        
        filter_complex = ""
        for i in range(1, len(parts)):
            delay = 500  # Default 500ms
            if i == 3: # El comando a MediLink tiene pausa mayor
                delay = 1000
            
            filter_complex += f"[{i}:a]adelay={delay}|{delay}[a{i}];"

        concat_inputs = "[0:a]" + "".join([f"[a{i}]" for i in range(1, len(parts))])
        filter_complex += f"{concat_inputs}concat=n={len(parts)}:v=0:a=1[outa]"
        
        inputs = " ".join([f"-i {p}" for p in parts])
        cmd = f"ffmpeg -y {inputs} -filter_complex \"{filter_complex}\" -map \"[outa]\" {output_path}"
        
        print(f"Concatenando partes con ffmpeg...")
        subprocess.run(cmd, shell=True, check=True)
        print(f"✅ ¡Audio generado exitosamente en {output_path}!")

if __name__ == "__main__":
    asyncio.run(main())
