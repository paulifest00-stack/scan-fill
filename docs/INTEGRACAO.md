# Integração com Bling

## Integração implementada em 02/10/2026 (UTC)

O app agora tem um adapter remoto e a tela de conexão com o Gateway do repositório `Paulifest-Seller-Copilot`. Sem uma URL configurada, continua em modo local; com uma URL configurada, não usa produtos fictícios quando a conexão falha.

- OAuth usa `/auth/bling/start`, callback do Gateway e `/auth/bling/session`. O usuário autoriza no Bling e retorna ao app para concluir o pareamento.
- Somente a sessão do Gateway fica no sessionStorage do navegador. Tokens Bling, client secret e renovação OAuth permanecem no backend PostgreSQL existente. Fechar a sessão do navegador pode exigir reconectar.
- `VITE_GATEWAY_URL` configura o endereço no build; a tela permite configurar ou trocar o endereço sem recompilar.
- Listagem e busca por nome são feitas pelo filtro oficial da API; SKU/EAN têm consulta exata. A semântica de busca por nome depende do filtro do Bling.
- Fotos são enviadas ao Gateway, armazenadas em PostgreSQL e recebem URL pública aleatória. Essas fotos serão públicas para poderem ser acessadas pelo Bling. Não enviar fotos com conteúdo privado.
- Editar faz PATCH apenas dos campos alterados e preserva outros campos fiscais. O hash da ficha e saldo serve para detectar conflitos antes da gravação; o Bling não oferece compare-and-swap aqui, então uma edição diretamente no ERP ainda pode ocorrer entre a conferência e o PATCH.
- Custo usa o vínculo de fornecedor; o contato fornecedor pode ser escolhido ao buscar seu nome. O Bling precisa permitir esse vínculo e o escopo de produtos fornecedores/contatos.
- Estoque representa saldo físico total; o balanço ocorre no depósito explicitamente escolhido, preservando o saldo dos demais depósitos.
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

Client secret nunca deve ser colocado em `VITE_*`, no GitHub ou no frontend. A análise por IA continua indisponível até conectar um provedor próprio.

## Validação

TypeScript, build e testes locais com HTTP/rede simulada. Ainda sem credenciais, sem Gateway público confirmado, sem migração contra PostgreSQL real nesta rodada e sem homologação de produtos ou estoque da conta Paulifest.
