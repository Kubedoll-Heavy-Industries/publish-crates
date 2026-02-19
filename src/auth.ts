import {getIDToken, info} from '@actions/core'
import {HttpClient} from '@actions/http-client'

const CRATES_IO_OIDC_AUDIENCE = 'https://crates.io'
const CRATES_IO_OIDC_TOKEN_URL =
    'https://crates.io/api/v1/trusted_publishing/tokens'

interface TrustedPublishingTokenResponse {
    token: string
}

export async function exchangeOidcToken(): Promise<string> {
    info('Requesting OIDC token for crates.io trusted publishing')

    let oidcToken: string
    try {
        oidcToken = await getIDToken(CRATES_IO_OIDC_AUDIENCE)
    } catch (err) {
        throw new Error(
            `Failed to request OIDC token. Trusted publishing requires \`id-token: write\` permission in your workflow. ` +
                `Add \`permissions: id-token: write\` to your job configuration. ` +
                `Original error: ${err}`
        )
    }

    info('Exchanging OIDC token for crates.io registry token')

    const client = new HttpClient('publish-crates')
    const body = JSON.stringify({jwt: oidcToken})
    const res = await client.post(CRATES_IO_OIDC_TOKEN_URL, body, {
        'Content-Type': 'application/json'
    })

    const rawBody = await res.readBody()

    if (res.message.statusCode !== 200) {
        throw new Error(
            `Failed to exchange OIDC token with crates.io (status: ${res.message.statusCode}). ` +
                `Ensure trusted publishing is configured for this repository on crates.io. ` +
                `Response: ${rawBody}`
        )
    }

    let parsed: TrustedPublishingTokenResponse
    try {
        parsed = JSON.parse(rawBody)
    } catch (err) {
        throw new Error(
            `Failed to parse crates.io trusted publishing response: ${err}`
        )
    }

    if (!parsed.token) {
        throw new Error(
            'crates.io trusted publishing response did not contain a token'
        )
    }

    info('Successfully obtained crates.io registry token via trusted publishing')
    return parsed.token
}
