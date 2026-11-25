#!/usr/bin/env bash
# Signs in to the Dev Hub or the test org with the JWT bearer flow, from the secrets of the
# CI (docs/einrichtung.md). Without the secrets it says so and ends with status 3, which
# the workflow takes as "not set up yet" rather than as an error.
#
#   scripts/ci-login.sh devhub
#   scripts/ci-login.sh testorg
source "$(dirname "$0")/lib/common.sh"

case "${1:-}" in
    devhub)
        if [ -z "${SF_DEVHUB_USERNAME:-}" ]; then
            echo "Dev Hub nicht eingerichtet (Secrets SF_DEVHUB_*), Paketbau entfaellt."
            summary "Dev Hub nicht eingerichtet, kein Paket gebaut. Siehe docs/einrichtung.md."
            exit 3
        fi
        require_env SF_DEVHUB_CLIENT_ID SF_DEVHUB_USERNAME SF_DEVHUB_JWT_KEY
        sf_login devhub "$SF_DEVHUB_CLIENT_ID" "$SF_DEVHUB_USERNAME" "$SF_DEVHUB_JWT_KEY" \
            "${SF_DEVHUB_LOGIN_URL:-https://login.salesforce.com}" devhub
        ;;
    testorg)
        if [ -z "${SF_TESTORG_USERNAME:-}" ]; then
            echo "Test-Org nicht eingerichtet (Secrets SF_TESTORG_*), Upgrade-Test entfaellt."
            summary "Test-Org nicht eingerichtet, kein Upgrade-Test. Siehe docs/einrichtung.md."
            exit 3
        fi
        require_env SF_TESTORG_CLIENT_ID SF_TESTORG_USERNAME SF_TESTORG_JWT_KEY
        sf_login testorg "$SF_TESTORG_CLIENT_ID" "$SF_TESTORG_USERNAME" "$SF_TESTORG_JWT_KEY" \
            "${SF_TESTORG_LOGIN_URL:-https://login.salesforce.com}"
        ;;
    *)
        fail "Aufruf: scripts/ci-login.sh devhub|testorg"
        ;;
esac
