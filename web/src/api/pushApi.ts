import { apiClient } from './client';
import type { ApiResponse } from './types';

export interface PushConfig {
  /** false 면 서버에 푸시 키가 없어 켤 수 없다 */
  enabled: boolean;
  publicKey: string;
}

/** 알림 종류별 수신 여부 */
export interface PushPreferences {
  comments: boolean;
  replies: boolean;
  likes: boolean;
  follows: boolean;
}

export interface PushTestResult {
  devices: number;
  delivered: number;
}

/** 브라우저의 PushSubscription.toJSON() 모양 */
export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function getPushConfig(): Promise<PushConfig> {
  const response = await apiClient.get<ApiResponse<PushConfig>>('/push/config');
  return response.data.data;
}

export async function saveSubscription(subscription: PushSubscriptionJson): Promise<void> {
  await apiClient.put('/push/subscription', subscription);
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  await apiClient.delete('/push/subscription', { data: { endpoint } });
}

export async function getPushPreferences(): Promise<PushPreferences> {
  const response = await apiClient.get<ApiResponse<PushPreferences>>('/push/preferences');
  return response.data.data;
}

export async function savePushPreferences(preferences: PushPreferences): Promise<PushPreferences> {
  const response = await apiClient.put<ApiResponse<PushPreferences>>('/push/preferences', preferences);
  return response.data.data;
}

export async function sendTestPush(): Promise<PushTestResult> {
  const response = await apiClient.post<ApiResponse<PushTestResult>>('/push/test');
  return response.data.data;
}
