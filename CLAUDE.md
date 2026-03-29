# CLAUDE.md — Social Publisher

## Identidade do Projeto
- **Nome:** Social Publisher
- **Cliente/Dono:** Zethera (infraestrutura interna)
- **Descrição:** Microserviço de publicação social via Buffer API. Usado pelos agentes OpenClaw para agendar posts no Instagram (@zethera.co) e LinkedIn (Zethera). Roda em Docker no VPS.
- **Repositório:** github.com/cmoliterno/social-publisher

## Stack Tecnológica
Node.js + Express + Buffer API + node-cron

## Estrutura do Projeto
src/ — microserviço simples

## Workflow de Desenvolvimento
1. **Desenvolvimento local:** Clonar repo, seguir README para setup
2. **PRs obrigatórios:** Nunca commitar direto na main
3. **Testes:** Rodar antes de qualquer PR
4. **Deploy:** Conforme documentado no README/DEPLOY.md

## Regras e Convenções
- Português brasileiro em todos os textos de usuário
- TypeScript strict — sem any implícito
- Componentes Shadcn/ui — não criar UI do zero se Shadcn tiver o componente
- Tailwind para estilos — sem CSS modules ou styled-components
- Projeto interno — mais liberdade para refatorar e experimentar

## Notas Críticas
Serviço interno — roda em http://social-publisher:3500. Instagram channel: 69c6d8e0af47dacb69605b03. LinkedIn channel: 69c6d921af47dacb69605c10. Agentes usam POST /publish.

---
*Gerado automaticamente pelo OpenClaw — Zethera AI Stack — 2026-03-29*
