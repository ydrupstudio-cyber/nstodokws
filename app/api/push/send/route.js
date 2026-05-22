import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

let vapidInitialized = false;
function ensureVapid() {
  if (vapidInitialized) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    throw new Error('VAPID 키가 설정되지 않았습니다. Vercel 환경 변수를 확인해주세요.');
  }
  webpush.setVapidDetails('mailto:noreply@nstodokws.vercel.app', pub, priv);
  vapidInitialized = true;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function POST(request) {
  try {
    ensureVapid();
    const supabase = getSupabase();
    const body = await request.json();
    const { title, message, urgent, targetYearLevel, todoId, excludeMemberId } = body;

    // 알림 받을 멤버 결정
    // - targetYearLevel이 'all'이거나 null이면 모든 활성 멤버
    // - 그 외엔 해당 연차 + 'all' 담당
    let query = supabase
      .from('members')
      .select('id, push_enabled')
      .eq('active', true)
      .eq('push_enabled', true);

    if (targetYearLevel && targetYearLevel !== 'all') {
      query = query.in('year_level', [targetYearLevel, 'pa']);
      // PA도 알림 받음 (의국 운영 시 가능). pa role도 알림 받게 함
      // 단 일반적으로 연차 지정 알림은 그 연차만 + pa 본인 결정
      // 더 명확하게: targetYearLevel + pa
    }

    const { data: members, error: memErr } = await query;
    if (memErr) {
      return Response.json({ error: memErr.message }, { status: 500 });
    }

    const memberIds = members
      .map((m) => m.id)
      .filter((id) => id !== excludeMemberId);
    if (memberIds.length === 0) {
      return Response.json({ sent: 0, message: 'No eligible members' });
    }

    // 구독 정보 가져오기
    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('member_id', memberIds)
      .eq('enabled', true);

    if (subErr) {
      return Response.json({ error: subErr.message }, { status: 500 });
    }

    const payload = JSON.stringify({
      title: title || 'NS_To-Do',
      body: message || '',
      urgent: urgent === true,
      todoId,
      url: '/',
      tag: todoId ? `todo-${todoId}` : 'ns-todo',
    });

    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        const subscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        try {
          await webpush.sendNotification(subscription, payload);
          return { success: true };
        } catch (err) {
          // 구독이 만료되거나 무효한 경우 삭제
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
          return { success: false, error: err.message };
        }
      })
    );

    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;

    return Response.json({ sent: successful, total: subs.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
