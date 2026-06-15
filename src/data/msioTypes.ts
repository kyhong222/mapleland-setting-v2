/**
 * maplestory.io 원시(raw) 응답 타입 (필요한 필드만 정의).
 * 누락/추가 필드 대응을 위해 metaInfo는 인덱스 시그니처를 둔다.
 */

export interface MsioItemDescription {
  id: number
  name: string
  description: string
}

export interface MsioMetaInfo {
  reqLevel?: number
  reqLevelEquip?: number
  reqJob?: number
  incSTR?: number
  incDEX?: number
  incINT?: number
  incLUK?: number
  incMHP?: number
  incMMP?: number
  incPAD?: number
  incMAD?: number
  incPDD?: number
  incMDD?: number
  incACC?: number
  incEVA?: number
  incSpeed?: number
  incJump?: number
  attackSpeed?: number
  tuc?: number
  /** 그 외 필드(스프라이트/플래그 등) */
  [key: string]: unknown
}

export interface MsioTypeInfo {
  overallCategory?: string
  category?: string
  subCategory?: string
  lowItemId?: number
  highItemId?: number
}

/** /item/{id} 응답(스프라이트 frameBooks는 무시) */
export interface MsioItemSpec {
  id: number
  description?: MsioItemDescription
  metaInfo?: MsioMetaInfo
  typeInfo?: MsioTypeInfo
}

/** /item/{id}/name 응답 */
export interface MsioItemName {
  id: number
  name: string
  description: string
}
