export type AssetKind = 'reference' | 'image' | 'video' | 'music' | 'render';
export type Gate = 'concept' | 'assets' | 'render' | 'publish';
export type Decision = 'approved' | 'rejected';
export type CampaignStatus = 'draft' | 'planned' | 'assets_review' | 'ready_to_render' | 'rendering' | 'rendered' | 'exported' | 'failed';
export interface Garment { id:string; designNumber:string; fabric:string; color:string; includesNecklace:boolean; includesDupatta:boolean; notes:string; createdAt:string; }
export interface Shot { id:string; startSeconds:number; endSeconds:number; title:string; visual:string; camera:string; lighting:string; }
export interface CampaignPlan { creativeDirection:string; concepts:{title:string;description:string}[]; shots:Shot[]; hook:string; caption:string; onScreenText:string[]; hashtags:string[]; description:string; musicBrief:string; preservationChecklist:string[]; trendNotes:string; }
export interface Campaign { id:string; garmentId:string; title:string; concept:string; status:CampaignStatus; version:number; budgetCents:number; spentCents:number; reservedCents:number; durationSeconds:number; createdAt:string; updatedAt:string; plan:CampaignPlan|null; }
export interface QaReport { technicalPassed:boolean; garmentAccuracy:'pending'|'pass'|'fail'; notes:string; checkedAt:string; licenseConfirmed?:boolean; }
export interface Asset { id:string; garmentId:string; campaignId:string|null; kind:AssetKind; filename:string; mimeType:string; url:string; sha256:string; bytes:number; createdAt:string; approved:boolean; qa:QaReport|null; }
export interface Approval { id:string; campaignId:string; gate:Gate; version:number; decision:Decision; note:string; createdAt:string; }
export interface Job { id:string; campaignId:string; kind:'render'|'image'|'video'; status:'queued'|'running'|'completed'|'failed'|'blocked'; message:string; createdAt:string; updatedAt:string; outputAssetId:string|null; version?:number; reservationId?:string; providerRequestId?:string; }
export interface TrendSource { id:string; campaignId:string|null; url:string; title:string; notes:string; observedAt:string; permission:'public_editorial'|'owned_insights'|'licensed'|'user_supplied'; }
export interface StudioEvent { id:string; campaignId:string|null; type:string; message:string; createdAt:string; }
export interface Integration { id:string; name:string; status:'ready'|'not_configured'|'blocked'; detail:string; }
export interface Snapshot { garments:Garment[]; campaigns:Campaign[]; assets:Asset[]; approvals:Approval[]; jobs:Job[]; sources:TrendSource[]; events:StudioEvent[]; integrations:Integration[]; }
export interface Action { type:string; [key:string]:unknown; }
