'use client';

import { supabase } from './supabase';
import { urlBase64ToUint8Array } from './utils';

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (e) {
    console.error('SW registration failed:', e);
    return null;
  }
}

export async function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function subscribeToPush(memberId) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('VAPID 키가 설정되지 않았어요. 관리자에게 문의하세요.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('알림 권한이 거부되었어요.');
  }

  const reg = await navigator.serviceWorker.ready;

  // 기존 구독이 있으면 가져오기, 없으면 새로 만들기
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  // DB에 저장
  const subJson = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      member_id: memberId,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
      enabled: true,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: 'member_id,endpoint' }
  );
  if (error) throw error;

  // 멤버 프로필에도 ON 표시
  await supabase.from('members').update({ push_enabled: true }).eq('id', memberId);

  return sub;
}

export async function unsubscribeFromPush(memberId) {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    // DB에서도 삭제
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('member_id', memberId)
      .eq('endpoint', endpoint);
  }
  // 프로필 OFF
  await supabase.from('members').update({ push_enabled: false }).eq('id', memberId);
}

export async function checkSubscriptionStatus(memberId) {
  if (!await isPushSupported()) return { supported: false };

  const perm = await getNotificationPermission();
  if (perm !== 'granted') return { supported: true, subscribed: false, permission: perm };

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { supported: true, subscribed: false, permission: perm };

  // DB에 enabled 상태 확인
  const { data: member } = await supabase
    .from('members')
    .select('push_enabled')
    .eq('id', memberId)
    .single();

  return {
    supported: true,
    subscribed: true,
    enabled: member?.push_enabled ?? true,
    permission: perm,
  };
}
