# Medidor de Consumo

Monitor local para estimar o consumo do PC usando a potência da CPU e da GPU.
Ele grava os intervalos no SQLite e mostra um dashboard React com consumo de
hoje, custo, média diária, projeção mensal e gráficos.

> É uma estimativa: CPU + GPU + 50 W extras para placa-mãe, RAM, ventoinhas,
> monitor e perdas da fonte. Não substitui uma tomada com medidor de energia.

## Requisitos

- Windows 11
- [uv](https://docs.astral.sh/uv/)
- [Node.js LTS](https://nodejs.org/)
- Libre Hardware Monitor extraído no computador

## Preparação

1. Baixe o Libre Hardware Monitor pelo [repositório oficial](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases).
2. Copie as DLLs extraídas para a pasta `lib/` do projeto, incluindo
   `LibreHardwareMonitorLib.dll`.
3. Instale as dependências:

```powershell
uv sync
```

4. Prepare o frontend:

```powershell
cd frontend
npm install
npm run build
cd ..
```

## Uso

Para iniciar o monitor:

```powershell
uv run medidor-consumo
```

Em outro terminal, inicie a API que também entrega o frontend compilado:

```powershell
uv run --no-sync uvicorn medidor_consumo.api:app --host 127.0.0.1 --port 8000
```

Ou dê dois cliques em `abrir-medidor.cmd`: ele inicia o monitor em segundo
plano, prepara o frontend quando necessário e abre o dashboard em
`http://localhost:8000`.

Durante o desenvolvimento do frontend, mantenha a API na porta 8000 e rode:

```powershell
cd frontend
npm run dev
```

O Vite abre a interface de desenvolvimento e encaminha as chamadas `/api` para
o FastAPI.

Os dados ficam somente em `data/consum.db` e não são enviados para lugar nenhum.

## Como a estimativa funciona

- A cada 2,5 segundos, o projeto lê `CPU Package` e `GPU Package`.
- Soma 50 W configuráveis em `EXTRA_POWER_W`.
- Converte watts e tempo decorrido em kWh.
- Multiplica o kWh por `PRICE_PER_KWH_BRL` para estimar o custo.

O valor padrão atual é R$ 0,82 por kWh. Ajuste as duas constantes em
`src/medidor_consumo/__init__.py` conforme o seu PC e a sua conta de luz.

## Inicialização automática

O agendador do Windows inicia somente o coletor escondido ao entrar na conta.
Como a leitura de potência pode exigir privilégios de administrador, a tarefa
`Medidor de Consumo` deve estar configurada com **Executar com privilégios mais
altos**. A API e o dashboard continuam abrindo manualmente pelo atalho quando
você quiser; eles não precisam de privilégios de administrador.
