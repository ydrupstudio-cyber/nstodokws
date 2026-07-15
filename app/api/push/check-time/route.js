import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// 클라이언트가 주기적으로 호출 → 2시간 임박 할일 찾아서 알림 발송
export async function POST(request) {
  try {
    const supabase = getSupabase();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 8);

    // 2시간 후 시각
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const twoHoursLaterTime = twoHoursLater.toTimeString().slice(0, 8);

    // 오늘 + 시간이 있는 + 미완료 + 긴급 아닌 (이미 긴급은 알림 갔으니까) 할일
    const { data: todos } = await supabase
      .from('todos')
      .select('*')
      .eq('date', today)
      .eq('done', false)
      .not('due_time', 'is', null)
      .gte('due_time', currentTime)
      .lte('due_time', twoHoursLaterTime);

    if (!todos || todos.length === 0) {
      return Response.json({ checked: 0, sent: 0 });
    }

    // 이미 알림 보낸 건 제외
    const todoIds = todos.map((t) => t.id);
    const { data: already } = await supabase
      .from('time_notification_sent')
      .select('todo_id')
      .in('todo_id', todoIds);

    const alreadySet = new Set((already || []).map((r) => r.todo_id));
    const toNotify = todos.filter((t) => !alreadySet.has(t.id));

    let totalSent = 0;
    for (const todo of toNotify) {
      // 시간 임박 알림 발송
      const baseUrl = request.headers.get('origin') || `https://${request.headers.get('host')}`;
      try {
        await fetch(`${baseUrl}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '⏰ 시간 임박 (2시간 이내)',
            message: `${todo.due_time.slice(0, 5)} — ${todo.text}`,
            urgent: true,
            targetYearLevel: todo.year_level,
            todoId: todo.id,
          }),
        });
        totalSent++;
      } catch (e) {
        console.error('send fail:', e);
      }

      // 기록
      await supabase.from('time_notification_sent').insert({ todo_id: todo.id });
    }

    return Response.json({ checked: todos.length, sent: totalSent });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
