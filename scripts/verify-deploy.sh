#!/usr/bin/env bash
# Verificação de um ambiente publicado, só com HTTP.
#
# Confere o que depende do servidor estar configurado corretamente: conexão com
# o Supabase, proteção das rotas privadas e — o mais importante — que a chave
# secreta não escapou para o HTML entregue ao navegador.
#
# Uso: scripts/verify-deploy.sh https://seu-dominio
set -uo pipefail

BASE="${1:?informe a URL base}"
SLUG="${DEMO_SLUG:-demo}"
PASS=0; FAIL=0

ok()   { printf '  ok   %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  FALHA %s%s\n' "$1" "${2:+ — $2}"; FAIL=$((FAIL+1)); }

check()    { [ "$2" = "$3" ] && ok "$1" || bad "$1" "esperado $3, veio $2"; }
contains() { printf '%s' "$2" | grep -qF -- "$3" && ok "$1" || bad "$1" "não encontrou \"$3\""; }

# Checagem de ausência só vale sobre conteúdo real. Uma resposta vazia — de um
# reset de conexão, por exemplo — não contém nada e passaria trivialmente, o que
# transformaria o teste de vazamento em falso conforto.
absent() {
  if [ -z "$2" ]; then bad "$1" "resposta vazia: verificação inconclusiva"; return; fi
  printf '%s' "$2" | grep -qF -- "$3" && bad "$1" "encontrou \"$3\"" || ok "$1"
}

# Redes intermediárias derrubam conexões esporadicamente; um 000 isolado não diz
# nada sobre a aplicação. Só desiste depois de três tentativas.
code() {
  local status
  for _ in 1 2 3; do
    status=$(curl -sS -o /dev/null -w '%{http_code}' "$1" 2>/dev/null)
    [ -n "$status" ] && [ "$status" != "000" ] && { printf '%s' "$status"; return; }
    sleep 2
  done
  printf '%s' "${status:-000}"
}

fetch() {
  local body
  for _ in 1 2 3; do
    body=$(curl -sS "$1" 2>/dev/null)
    [ -n "$body" ] && { printf '%s' "$body"; return; }
    sleep 2
  done
  printf ''
}

echo "Conectividade"
contains "alcança o Supabase a partir do servidor" "$(fetch "$BASE/api/health")" '"ok":true'

echo; echo "Canal público"
CANAL=$(fetch "$BASE/$SLUG")
if [ -z "$CANAL" ]; then bad "canal responde" "sem resposta após 3 tentativas"; else
  ok "canal responde"
  contains "canal carrega dados do banco" "$CANAL" "Registrar manifestação"
fi
check "formulário responde" "$(code "$BASE/$SLUG/registrar")" "200"
check "consulta responde" "$(code "$BASE/$SLUG/consultar")" "200"
check "canal inexistente devolve 404" "$(code "$BASE/nao-existe-$RANDOM")" "404"

echo; echo "Rotas protegidas"
check "painel exige sessão" "$(code "$BASE/painel")" "307"
check "painel da plataforma exige sessão" "$(code "$BASE/master")" "307"
check "ocorrências exige sessão" "$(code "$BASE/painel/ocorrencias")" "307"
check "login acessível" "$(code "$BASE/entrar")" "200"

echo; echo "Canal público não aceita anexo sem o código"
post_anexo() {
  local status
  for _ in 1 2 3; do
    status=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
      -F "protocol=OUV-2026-000001" -F "tracking_code=AAAA-BBBB-CCCC-DDDD" \
      -F "files=@/dev/null;filename=x.png;type=image/png" \
      "$BASE/api/ouvidoria/$SLUG/anexos" 2>/dev/null)
    [ -n "$status" ] && [ "$status" != "000" ] && { printf '%s' "$status"; return; }
    sleep 2
  done
  printf '%s' "${status:-000}"
}
check "código errado é recusado" "$(post_anexo)" "403"

echo; echo "Vazamento de segredos"
# A chave secreta ignora o RLS. Se aparecer no que vai ao navegador, o banco
# inteiro está exposto — por isso estas três checagens exigem corpo não vazio.
absent "chave secreta fora do HTML do canal" "$CANAL" "service_role"
absent "chave secreta fora do HTML do login" "$(fetch "$BASE/entrar")" "service_role"

JS=$(printf '%s' "$CANAL" \
  | grep -o '/_next/static/[^"\\]*\.js' | sort -u | head -8)
if [ -z "$JS" ]; then
  bad "chave secreta fora dos bundles JavaScript" "nenhum bundle encontrado no HTML"
else
  LEAK=""
  for path in $JS; do LEAK="$LEAK$(fetch "$BASE$path")"; done
  absent "chave secreta fora dos bundles JavaScript ($(printf '%s' "$JS" | wc -l | tr -d ' ') arquivos)" "$LEAK" "service_role"
fi

echo; echo "$PASS verificações passaram, $FAIL falharam."
[ "$FAIL" -eq 0 ]
