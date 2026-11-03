const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');
const { randomUUID } = require('node:crypto');

const PORT = process.env.PORT || 3333;
const DATA = path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');
const DB = { salas: path.join(DATA, 'salas.json'), reservas: path.join(DATA, 'reservas.json') };
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

async function read(collection) {
  try { return JSON.parse(await fs.readFile(DB[collection], 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
async function write(collection, data) {
  const temp = DB[collection] + '.tmp';
  await fs.writeFile(temp, JSON.stringify(data, null, 2));
  await fs.rename(temp, DB[collection]);
}
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 1e6) throw Object.assign(new Error('Corpo da requisição muito grande.'), { status: 413 }); }
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
}
const fail = (message, status=400) => Object.assign(new Error(message), { status });
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value + 'T12:00:00'));
const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');

async function validateSala(input, id) {
  const nome = String(input.nome || '').trim();
  const localizacao = String(input.localizacao || '').trim();
  const capacidade = Number(input.capacidade);
  const recursos = Array.isArray(input.recursos) ? input.recursos.map(x => String(x).trim()).filter(Boolean) : String(input.recursos || '').split(',').map(x => x.trim()).filter(Boolean);
  const situacao = input.situacao || 'Disponível';
  if (!nome || !localizacao) throw fail('Nome e localização são obrigatórios.');
  if (!Number.isInteger(capacidade) || capacidade < 1) throw fail('A capacidade deve ser um número inteiro maior que zero.');
  if (!['Disponível','Inativa'].includes(situacao)) throw fail('Situação da sala inválida.');
  return { id: id || randomUUID(), nome, localizacao, capacidade, recursos, situacao };
}
async function validateReserva(input, id) {
  const salas = await read('salas');
  const sala = salas.find(s => s.id === input.salaId);
  if (!sala) throw fail('Sala não encontrada.', 404);
  if (sala.situacao !== 'Disponível') throw fail('Esta sala está inativa e não pode receber reservas.');
  const aluno = String(input.aluno || '').trim(), email = String(input.email || '').trim();
  const finalidade = String(input.finalidade || '').trim();
  const data = input.data, inicio = input.inicio, fim = input.fim;
  const participantes = Number(input.participantes);
  const status = input.status || 'Ativa';
  if (!aluno || !email || !finalidade || !data || !inicio || !fim || !input.salaId) throw fail('Preencha todos os campos obrigatórios.');
  if (!validEmail(email)) throw fail('Informe um e-mail válido.');
  if (!validDate(data) || !validTime(inicio) || !validTime(fim)) throw fail('Data ou horário inválido.');
  if (fim <= inicio) throw fail('O horário final deve ser posterior ao horário inicial.');
  if (!Number.isInteger(participantes) || participantes < 1) throw fail('A quantidade de participantes deve ser um inteiro positivo.');
  if (participantes > sala.capacidade) throw fail(`Capacidade excedida. A sala comporta até ${sala.capacidade} pessoas.`);
  if (!['Ativa','Cancelada'].includes(status)) throw fail('Status da reserva inválido.');
  const reservas = await read('reservas');
  if (status === 'Ativa') {
    const conflito = reservas.find(r => r.id !== id && r.status === 'Ativa' && r.salaId === sala.id && r.data === data && inicio < r.fim && fim > r.inicio);
    if (conflito) throw fail(`Conflito de horário: já existe uma reserva ativa nesta sala das ${conflito.inicio} às ${conflito.fim}.`, 409);
  }
  return { id: id || randomUUID(), aluno, email, salaId: sala.id, data, inicio, fim, participantes, finalidade, status, criadoEm: id ? undefined : new Date().toISOString() };
}
async function routeApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const resource = parts[1], id = parts[2];
  if (resource === 'feriados' && req.method === 'GET') {
    const ano = parts[2];
    if (!/^\d{4}$/.test(ano || '')) return send(res, 400, { erro: 'Informe um ano válido.' });
    try {
      const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`, { signal: AbortSignal.timeout(7000) });
      if (!response.ok) return send(res, 502, { erro: 'Não foi possível consultar os feriados agora.' });
      return send(res, 200, await response.json());
    } catch { return send(res, 502, { erro: 'BrasilAPI indisponível. Você pode continuar a reserva normalmente.' }); }
  }
  if (!['salas','reservas'].includes(resource)) return send(res, 404, { erro: 'Rota não encontrada.' });
  try {
    const rows = await read(resource);
    if (req.method === 'GET' && !id) {
      let result = rows;
      if (resource === 'reservas') {
        const data = url.searchParams.get('data'), salaId = url.searchParams.get('salaId'), status = url.searchParams.get('status');
        if (data) result = result.filter(r => r.data === data);
        if (salaId) result = result.filter(r => r.salaId === salaId);
        if (status) result = result.filter(r => r.status === status);
      }
      return send(res, 200, result);
    }
    if (req.method === 'GET' && id) {
      const item = rows.find(x => x.id === id);
      return item ? send(res, 200, item) : send(res, 404, { erro: 'Registro não encontrado.' });
    }
    if (req.method === 'POST' && !id) {
      const input = await body(req);
      if (resource === 'salas') {
        const sala = await validateSala(input);
        rows.push(sala); await write(resource, rows); return send(res, 201, sala);
      }
      const reserva = await validateReserva(input);
      rows.push(reserva); await write(resource, rows); return send(res, 201, reserva);
    }
    if (req.method === 'PUT' && id) {
      const index = rows.findIndex(x => x.id === id);
      if (index < 0) return send(res, 404, { erro: 'Registro não encontrado.' });
      const input = await body(req);
      if (resource === 'salas') {
        const sala = await validateSala(input, id);
        // Impede reduzir capacidade abaixo de reservas ativas existentes.
        const reservas = await read('reservas');
        const maior = Math.max(0, ...reservas.filter(r => r.salaId === id && r.status === 'Ativa').map(r => r.participantes));
        if (sala.capacidade < maior) throw fail(`Há reserva ativa com ${maior} participantes. Capacidade não pode ser menor que isso.`);
        rows[index] = sala;
      } else {
        const reserva = await validateReserva(input, id);
        rows[index] = { ...reserva, criadoEm: rows[index].criadoEm };
      }
      await write(resource, rows); return send(res, 200, rows[index]);
    }
    if (req.method === 'DELETE' && id) {
      const index = rows.findIndex(x => x.id === id);
      if (index < 0) return send(res, 404, { erro: 'Registro não encontrado.' });
      if (resource === 'salas') {
        const reservas = await read('reservas');
        if (reservas.some(r => r.salaId === id)) throw fail('Não é possível excluir uma sala que possui reservas vinculadas.', 409);
      }
      const [removed] = rows.splice(index, 1); await write(resource, rows);
      return send(res, 200, { mensagem: 'Registro excluído com sucesso.', removido: removed });
    }
    return send(res, 405, { erro: 'Método não permitido.' });
  } catch (error) { return send(res, error.status || 500, { erro: error.message || 'Erro interno.' }); }
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return routeApi(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { erro: 'Método não permitido.' });
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(PUBLIC, '.' + pathname);
  if (!file.startsWith(PUBLIC + path.sep) && file !== path.join(PUBLIC, 'index.html')) return send(res, 403, { erro: 'Acesso negado.' });
  try {
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch { res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); res.end('Página não encontrada.'); }
});
(async () => {
  await fs.mkdir(DATA, { recursive: true });
  for (const name of Object.keys(DB)) { try { await fs.access(DB[name]); } catch { await fs.writeFile(DB[name], '[]'); } }
  server.listen(PORT, () => console.log(`Sistema de Reserva de Salas em http://localhost:${PORT}`));
})();