# Estado da integração

O catálogo atual usa apenas armazenamento local do navegador. Não existe conexão com o Bling nem envio automático de pendências. Não utilize esta versão como cadastro oficial do ERP. Fotos e produtos locais podem ser perdidos ao limpar os dados do navegador.

## Contratos

As telas acessam ProductRepository; consultas usam productKeys e suportam paginação por cursor. O futuro adapter remoto deve implementar list, get, findByCode, create e update, traduzindo falhas para RepoError. Listas retornam ProductSummary; fichas retornam Product. version deve ser preservado na edição e removido na duplicação.

## Backend pendente

- Autenticação da aplicação e OAuth Bling no servidor, com renovação segura de tokens.
- Adapter para produtos e categorias reais, com mapeamento de unidade, pesos em kg e dimensões em cm.
- Upload persistente de imagens; URLs locais não devem ser encaminhadas como imagens remotas.
- Estoque deve usar a operação adequada do ERP; não assumir que editar um produto altera seu saldo.
- Detecção de duplicidades e conflitos no backend, inclusive concorrência entre dispositivos.
- Análise de fotos por IA via servidor. Sugestões críticas precisam de confirmação; nenhuma credencial no frontend.

O Gateway do Seller Copilot deve ser inspecionado antes de escolher a infraestrutura compartilhada. Sua compatibilidade e homologação OAuth ainda não foram verificadas neste projeto.
