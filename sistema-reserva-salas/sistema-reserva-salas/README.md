# Reservaê — Sistema de Reserva de Salas

Aplicação web para gerenciamento de salas de estudo e laboratórios e suas reservas acadêmicas.

## Tecnologias
- Node.js nativo (`http`), sem Express ou frameworks
- NPM
- HTML5, CSS3 e JavaScript
- API REST com JSON
- Persistência em arquivos JSON
- BrasilAPI — feriados nacionais

## Requisitos
Node.js 18 ou superior.

## Como executar
```bash
npm start
```
Acesse http://localhost:3333

Modo de desenvolvimento (reinicia ao alterar arquivos do servidor):
```bash
npm run dev
```

## Funcionalidades
### Salas
- CRUD completo, identificador UUID, nome, localização, capacidade, recursos e situação.
- Não permite excluir sala que possua reservas vinculadas.
- Salas inativas não recebem reservas.

### Reservas
- CRUD completo com aluno, e-mail, sala, data, horários, participantes, finalidade e status.
- Impede sobreposição de horários de reservas ativas na mesma sala e data.
- Valida horário final, capacidade, e-mail, sala existente e situação.
- Filtros por data, sala e status.
- Confirmação antes de excluir.

### BrasilAPI
Ao selecionar uma data, o sistema consulta os feriados nacionais do ano correspondente:
`GET https://brasilapi.com.br/api/feriados/v1/{ano}`
A consulta é informativa. Se a API falhar, a reserva continua disponível.

## Endpoints REST

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/salas` | Listar salas |
| GET | `/api/salas/:id` | Consultar sala |
| POST | `/api/salas` | Cadastrar sala |
| PUT | `/api/salas/:id` | Atualizar sala |
| DELETE | `/api/salas/:id` | Excluir sala |
| GET | `/api/reservas` | Listar reservas |
| GET | `/api/reservas/:id` | Consultar reserva |
| POST | `/api/reservas` | Cadastrar reserva |
| PUT | `/api/reservas/:id` | Atualizar reserva |
| DELETE | `/api/reservas/:id` | Excluir reserva |
| GET | `/api/feriados/:ano` | Consultar feriados via BrasilAPI |

Filtros de reservas: `/api/reservas?data=2026-11-03&salaId=UUID&status=Ativa`.

## Exemplo de sala
```json
{
  "nome": "Laboratório 02",
  "localizacao": "Bloco B, primeiro andar",
  "capacidade": 24,
  "recursos": ["Computadores", "Projetor"],
  "situacao": "Disponível"
}
```

## Exemplo de reserva
```json
{
  "aluno": "Ana Souza",
  "email": "ana@faculdade.edu.br",
  "salaId": "UUID_DA_SALA",
  "data": "2026-11-10",
  "inicio": "14:00",
  "fim": "16:00",
  "participantes": 5,
  "finalidade": "Trabalho em grupo",
  "status": "Ativa"
}
```

## Status HTTP
- `200`: consulta, atualização ou exclusão realizada
- `201`: cadastro realizado
- `400`: dados inválidos
- `404`: registro/rota não encontrado
- `405`: método não permitido
- `409`: conflito de horário ou vínculo impede exclusão
- `502`: falha na consulta à BrasilAPI

## Persistência
Os arquivos `data/salas.json` e `data/reservas.json` são criados automaticamente e mantêm os registros após reiniciar o servidor. Faça backup desses arquivos antes de limpar os dados.

## Observações
Projeto acadêmico sem autenticação de usuários. Em um cenário real, seriam necessários autenticação, autorização, controle de concorrência transacional e proteção adicional de dados.
