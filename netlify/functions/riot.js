/**
 * Netlify Function — Riot API 프록시
 *
 * 브라우저 → /.netlify/functions/riot/api/kr/... → kr.api.riotgames.com/...
 * CORS 문제를 서버 사이드에서 해결합니다.
 * API 키는 Netlify 환경변수 RIOT_API_KEY 에서 읽습니다.
 */

const https = require('https')

// /api/PREFIX → 실제 Riot 도메인 매핑
const HOST_MAP = {
  'api/kr':       'kr.api.riotgames.com',
  'api/euw1':     'euw1.api.riotgames.com',
  'api/na1':      'na1.api.riotgames.com',
  'api/jp1':      'jp1.api.riotgames.com',
  'api/eun1':     'eun1.api.riotgames.com',
  'api/br1':      'br1.api.riotgames.com',
  'api/asia':     'asia.api.riotgames.com',
  'api/europe':   'europe.api.riotgames.com',
  'api/americas': 'americas.api.riotgames.com',
}

exports.handler = async (event) => {
  const API_KEY = process.env.RIOT_API_KEY

  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'RIOT_API_KEY 환경변수가 설정되지 않았습니다.' }),
    }
  }

  // event.path 예시: /.netlify/functions/riot/api/asia/riot/account/v1/...
  // 함수명 이후 전체를 추출: api/asia/riot/account/v1/...
  const stripped = event.path
    .replace(/^\/.netlify\/functions\/[^/]+\//, '')  // /.netlify/functions/riot/ 제거
  const segments = stripped.split('/').filter(Boolean)

  // prefix = "api/asia", apiPath = "/riot/account/v1/..."
  const prefix  = segments.slice(0, 2).join('/')
  const apiPath = '/' + segments.slice(2).join('/')
  const host    = HOST_MAP[prefix]

  if (!host) {
    return {
      statusCode: 404,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: `알 수 없는 리전 prefix: "${prefix}" / 전체경로: "${event.path}"` }),
    }
  }

  const fullPath = apiPath + (event.rawQuery ? `?${event.rawQuery}` : '')
  // URL에 한글 등 non-ASCII 문자가 있으면 인코딩
  const safePath = fullPath.split('/').map(seg =>
    seg.includes('%') ? seg : encodeURIComponent(seg).replace(/%2F/g, '/')
  ).join('/')

  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: host,
        path: safePath,
        headers: { 'X-Riot-Token': API_KEY },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: data,
          })
        })
      }
    )

    req.on('error', (e) => {
      resolve({
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: e.message }),
      })
    })
  })
}
