# Integração com Bling

## Integração implementada em 02/10/2026 (UTC)

O app agora tem um adapter remoto e a tela de conexão com o Gateway do repositório `Paulifest-Seller-Copilot`. O endereço padrão é `https://paulifest-seller-copilot-gateway.onrender.com`. Não usa produtos fictícios quando a conexão falha.

- OAuth usa `/auth/bling/start`, callback do Gateway e `/auth/bling/session`. O usuário autoriza no Bling e retorna ao app para concluir o pareamento.
- Somente a sessão do Gateway fica no sessionStorage do navegador. Tokens Bling, client secret e renovação OAuth permanecem no backend PostgreSQL existente. Fechar a sessão do navegador pode exigir reconectar.
- `VITE_GATEWAY_URL` configura o endereço no build; a tela permite configurar ou trocar o endereço sem recompilar.
- Listagem e busca por nome são feitas pelo filtro oficial da API; SKU/EAN têm consulta exata. A semântica de busca por nome depende do filtro do Bling.
- Fotos são enviadas ao Gateway, armazenadas em PostgreSQL e recebem URL pública aleatória. Essas fotos serão públicas para poderem ser acessadas pelo Bling. Não enviar fotos com conteúdo privado.
- Editar faz PATCH apenas dos campos alterados e preserva outros campos fiscais. O hash da ficha e saldo serve para detectar conflitos antes da gravação; o Bling não oferece compare-and-swap aqui, então uma edição diretamente no ERP ainda pode ocorrer entre a conferência e o PATCH.
- Custo usa automaticamente o registro padrão existente, inclusive sem contato fornecedor preenchido. Se o Bling não devolver nenhum registro, a API pública exige um vínculo para criação: não criamos contatos fictícios. Salve o custo uma vez no Bling e recarregue o produto.
- Estoque representa o saldo físico total desejado. O servidor calcula entradas/saídas pela diferença, escolhe automaticamente um depósito ativo e distribui saídas entre depósitos quando necessário, sem saldo negativo.
- Operações têm identificador persistente para evitar reenvio de uma criação já confirmada. Falhas após escrita ficam como resultado incerto e exigem conferência no Bling.
- Webhooks assinados invalidam o catálogo por revisão da empresa. O app verifica a revisão a cada 15 segundos enquanto está visível; não altera estoque automaticamente a partir de um evento.
- O filtro incompletos carrega a ficha real de cada item da página. Pode ser mais lento; a lista normal não inventa uma contagem a partir de campos omitidos pela API.

## Configuração necessária para uso real

1. Publicar a versão atualizada do Gateway com PostgreSQL, deixando a migração `003_mobile_catalog` executar no startup.
2. Configurar no servidor `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `BLING_REDIRECT_URI`, `DATABASE_URL`, `GATEWAY_ENCRYPTION_KEY`, `GATEWAY_JWT_SECRET`, `GATEWAY_PUBLIC_URL` e `GATEWAY_ALLOWED_WEB_ORIGINS`.
3. Cadastrar exatamente `https://SEU_GATEWAY/auth/bling/callback` no aplicativo Bling.
4. Cadastrar `https://SEU_GATEWAY/mobile/webhooks/bling` como servidor dos webhooks de produto, estoque e estoque virtual.
5. Liberar leitura/criação/alteração de produtos, categorias, estoque/depósitos, produtos fornecedores, contatos e dados básicos da empresa nos escopos do aplicativo. Alterar escopos pode exigir nova autorização.
6. Autorizar a conta na tela Conectar ao Bling e validar um cadastro/edição real controlado antes do uso diário.

Client secret nunca deve ser colocado em `VITE_*`, no GitHub ou no frontend. Descrição com IA: configure OPENAI_API_KEY no Render (opcional OPENAI_DESCRIPTION_MODEL, padrão gpt-4.1-mini). O botão gera uma sugestão revisável, sem salvar automaticamente. Fotos continuam sem análise por IA.

## Validação

TypeScript, build e testes locais com HTTP/rede simulada. Ainda sem credenciais, sem Gateway público confirmado, sem migração contra PostgreSQL real nesta rodada e sem homologação de produtos ou estoque da conta Paulifest.

## Publicação confirmada em 02/10/2026 (UTC)

O Gateway Render respondeu HTTP 200 em `/health`. Antes do novo deploy, `/mobile/products` retornou 404: a publicação das novas rotas ainda precisa ser confirmada. Os dois PRs de integração foram incorporados à main.

Callback cadastrado: `https://paulifest-seller-copilot-gateway.onrender.com/auth/bling/callback`.
Webhook: `https://paulifest-seller-copilot-gateway.onrender.com/mobile/webhooks/bling`.


Categorias: o seletor grava a categoria interna do Bling. Não é a categoria do anúncio no marketplace. Para o Mercado Livre, a Gestão de Anúncios sugere a categoria e carrega seus atributos exigidos. Não existe um conjunto universal de campos mínimos para todas as lojas. O formulário contém uma revisão de dados gerais; ela não certifica prontidão para exportação.
Fontes: https://ajuda.bling.com.br/hc/pt-br/articles/360040935294 e https://ajuda.bling.com.br/hc/pt-br/articles/34677719147415 .


## Categorias e Shopee
Sugestões pelo nome usam apenas categorias internas reais e nomes de vínculos já existentes. São sugestões por correspondência de palavras (incluindo alguns termos equivalentes), não classificações garantidas; o usuário escolhe antes de salvar.
O formulário consulta canais de venda ativos e categorias/lojas por conta. Ao selecionar a categoria interna, mostra o vínculo específico da loja (Shopee priorizada quando disponível). Para um primeiro vínculo, consulta anuncios/categorias pela integração e percorre a árvore. O servidor revalida o caminho e exige o último nível. A criação do vínculo é compartilhada por todos os produtos daquela categoria interna; a interface avisa esse alcance antes de confirmar. Não substitui vínculos existentes por inferência. Se a API do Bling rejeitar a árvore daquela integração, o primeiro vínculo precisa ser configurado no Bling; depois o catálogo consulta e usa o vínculo existente.
Campos customizados ativos do módulo Produtos são carregados conforme os agrupadores da categoria, quando a API disponibiliza o módulo e suas definições. Valores são salvos em camposCustomizados preservando idVinculo e os campos não alterados. Isto não cria automaticamente o mapeamento de atributos com a Shopee.
Descrição do formulário é gravada em descricaoCurta, exigida pelo fluxo Shopee. A descrição complementar existente é preservada; no primeiro salvamento, uma descrição complementar legada é aproveitada como descricaoCurta quando ela está vazia.
A revisão recolhida verifica os dados gerais publicados pelo Bling: nome, SKU, preço, peso bruto, dimensões até 70cm, descrição 10–5000 caracteres, imagem e categoria. Ela não certifica atributos da Shopee, vigência de categoria nem aprovação da exportação.
Escopos adicionais: canais de venda, categorias de lojas, anúncios/categorias e campos customizados (consulta), categorias de lojas (criação). Escopos ausentes exibem erro e não bloqueiam uma edição independente de preço/estoque.
Fontes: https://ajuda.bling.com.br/hc/pt-br/articles/360058302333-Categorias-da-Shopee e https://ajuda.bling.com.br/hc/pt-br/articles/4414423105815-Exporta%C3%A7%C3%A3o-de-produtos-para-a-Shopee .
