/**
 * maplestory.io API 설정.
 *
 * - 아이템 스펙: 기본 GMS 62, 존재하지 않으면 GMS 200으로 폴백.
 * - 한글명: KMS 300의 /name 엔드포인트로 별도 조회.
 */

export const MSIO_BASE = 'https://maplestory.io/api'

/** 아이템 스펙 조회 지역 */
export const ITEM_REGION = 'gms'
/** 기본 버전 */
export const ITEM_VERSION_PRIMARY = '62'
/** 기본 버전에 없을 때 폴백 버전 */
export const ITEM_VERSION_FALLBACK = '200'

/** 한글명 조회 지역/버전 */
export const NAME_REGION = 'kms'
export const NAME_VERSION = '300'
