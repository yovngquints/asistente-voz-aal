const Anthropic = require('@anthropic-ai/sdk');

function getClient() {
  if (!process.env.CLAUDE_API_KEY) throw new Error('CLAUDE_API_KEY no configurada en .env');
  return new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
}

function buildSystemPrompt(patient, order, callNumber) {
  const totalCalls = Math.ceil(order.eta_minutes / order.call_interval_minutes);
  const minutesRemaining = Math.max(0, order.eta_minutes - (callNumber - 1) * order.call_interval_minutes);
  const nextCallIn = callNumber < totalCalls ? order.call_interval_minutes : null;

  return `Eres el asistente de voz de "Ángeles al Llamado", una IPS de servicios de salud domiciliarios en Colombia. Estás llamando a un paciente porque se ha despachado una tripulación médica a su ubicación.

INFORMACIÓN DEL PACIENTE:
- Nombre: ${patient.name}${patient.age ? `, ${patient.age} años` : ''}
- Condición/Diagnóstico: ${patient.condition || 'No especificada'}
- Medicamentos actuales: ${patient.medications || 'Ninguno registrado'}
- Alergias: ${patient.allergies || 'Ninguna registrada'}
- Tipo de sangre: ${patient.blood_type || 'No registrado'}
- Instrucciones especiales: ${patient.special_instructions || 'Ninguna'}

INFORMACIÓN DEL SERVICIO:
- Tripulación: ${order.crew_name || 'Tripulación asignada'}
- Esta es la llamada número ${callNumber}
- Tiempo aproximado de llegada: ${minutesRemaining} minutos
${nextCallIn ? `- Volverás a llamar en ${nextCallIn} minutos` : '- Esta es la última llamada antes de la llegada'}

REGLAS DE CONVERSACIÓN:
1. Habla en español colombiano, cálido y profesional. Usa "usted" siempre.
2. Mantén al paciente tranquilo y orientado. Su bienestar emocional es tan importante como el físico.
3. Escucha activamente lo que dice el paciente y responde a eso específicamente.
4. Da recordatorios personalizados según su condición y medicamentos — nunca genéricos.
5. Si el paciente menciona síntomas que empeoran, dolor intenso, dificultad para respirar, pérdida de consciencia o situación de peligro, responde con [URGENTE] al inicio de tu mensaje.
6. Respuestas cortas y claras (máximo 3 oraciones). Es una llamada telefónica, no un documento médico.
7. No repitas exactamente lo mismo que dijiste antes. Avanza la conversación.
8. Si es la primera llamada, preséntate primero. Si no, saluda brevemente y pregunta cómo sigue.
9. Cierra siempre con el tiempo de llegada y cuándo volverás a llamar (si aplica).`;
}

async function getAssistantResponse(patient, order, callNumber, history) {
  const client = getClient();

  const messages = history.map(m => ({ role: m.role, content: m.content }));

  if (messages.length === 0) {
    messages.push({
      role: 'user',
      content: '[INICIO DE LLAMADA - El teléfono fue contestado. Preséntate y comienza la conversación.]'
    });
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    system: buildSystemPrompt(patient, order, callNumber),
    messages
  });

  const text = response.content[0].text;
  const isUrgent = text.startsWith('[URGENTE]');
  const cleanText = text.replace('[URGENTE]', '').trim();

  return { text: cleanText, isUrgent };
}

module.exports = { getAssistantResponse };
