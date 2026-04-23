// ===== BULK PROCESSOR (The Heart of the Shield) =====
const processEventBulk = async (userId: string, type: string, payload: any) => {
  try {
    switch (type) {
      case 'LIKE': {
        const { postId, action } = payload;
        if (action === 'add' || action === 'toggle') {
          // 1. Junction table (Idempotent because of unique constraint)
          const { error } = await supabase.from('post_likes').upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
          if (!error) await supabase.rpc('increment_likes', { p_id: postId });
        } else {
          await supabase.from('post_likes').delete().match({ post_id: postId, user_id: userId });
          await supabase.rpc('decrement_likes', { p_id: postId });
        }
        break;
      }
      case 'REPOST': {
        const { postId, action } = payload;
        if (action === 'add' || action === 'toggle') {
          const { error } = await supabase.from('post_reposts').upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
          if (!error) await supabase.rpc('increment_reposts', { p_id: postId });
        } else {
          await supabase.from('post_reposts').delete().match({ post_id: postId, user_id: userId });
          await supabase.rpc('decrement_reposts', { p_id: postId });
        }
        break;
      }
      case 'COMMENT': {
        const { postId, content } = payload;
        await supabase.from('post_comments').insert({ post_id: postId, user_id: userId, content });
        await supabase.rpc('increment_comments', { p_id: postId });
        break;
      }
      case 'POST': {
        const { content, image, location, repostedPostId } = payload;
        await supabase.from('posts').insert({ author_id: userId, content, image, location, reposted_post_id: repostedPostId });
        break;
      }
    }
  } catch (err) {
    console.error(`Bulk Item Error (${type}):`, err);
  }
};

// ===== HEARTBEAT ENDPOINT (Safe Flush) =====
app.post('/api/worker/heartbeat', async (req, res) => {
  const signature = req.headers['upstash-signature'] as string;
  try {
    const isValid = await qstashReceiver.verify({ signature, body: JSON.stringify(req.body) });
    if (!isValid) return res.status(401).json({ error: 'Unauthorized' });
  } catch (err) { return res.status(401).json({ error: 'Verification failed' }); }

  const processingKey = `community:processing:${Date.now()}`;

  try {
    // 1. ATOMIC MOVE: Rename current queue to a temporary processing queue
    // This ensures no new actions are lost while we process
    const exists = await redis.exists(REDIS_KEYS.PENDING_ACTIONS);
    if (!exists) return res.json({ success: true, message: 'Nothing to flush' });

    await redis.rename(REDIS_KEYS.PENDING_ACTIONS, processingKey);
    
    // 2. GET ALL ACTIONS
    const actions = await redis.lrange(processingKey, 0, -1);
    console.log(`💓 Heartbeat: Processing ${actions.length} actions from ${processingKey}`);

    // 3. BATCH PROCESS
    for (const actionStr of actions) {
      const action = typeof actionStr === 'string' ? JSON.parse(actionStr) : actionStr;
      await processEventBulk(action.userId, action.type, action.payload);
    }

    // 4. CLEANUP & CACHE REFRESH
    await redis.del(processingKey);

    const { data: posts } = await supabase.from("posts").select(`*, author:profiles!author_id(*), likes:post_likes!post_id(count), comments:post_comments!post_id(count), reposts:post_reposts!post_id(count)`).order("created_at", { ascending: false }).limit(50);
    if (posts) await redis.set(REDIS_KEYS.FEED_CACHE, posts, { ex: 300 });

    res.json({ success: true, flushed: actions.length });
  } catch (err) {
    console.error('CRITICAL: Heartbeat Flush Failed!', err);
    // If it fails, the data stays in 'processingKey' so we can recover it manually if needed
    res.status(500).json({ error: 'Flush failed' });
  }
});
