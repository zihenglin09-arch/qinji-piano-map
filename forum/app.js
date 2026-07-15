(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const config=window.QINJI_CLOUDBASE||{};
  let db=null,posts=[],replies=[],category='全部',watchers=[];
  const localPosts='qinji-forum-posts-v1',localReplies='qinji-forum-replies-v1';
  const readLocal=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
  const now=()=>new Date().toISOString();
  const formatTime=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'刚刚':d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})};
  const notify=message=>{const t=$('#toast');t.textContent=message;t.hidden=false;setTimeout(()=>t.hidden=true,2400)};
  const setStatus=(message,type='')=>{const el=$('#status');el.textContent=message;el.className=`status ${type}`.trim()};
  const idOf=item=>item._id||item.id;

  function render(){
    const q=$('#search').value.trim().toLowerCase();
    const list=posts.filter(p=>(category==='全部'||p.category===category)&&(`${p.title} ${p.content} ${p.nickname}`).toLowerCase().includes(q));
    $('#postCount').textContent=`${list.length} 个主题 · 内容实时更新`;
    $('#posts').innerHTML=list.length?list.map(p=>{const count=replies.filter(r=>r.postId===idOf(p)).length;return `<article class="post" data-post="${esc(idOf(p))}"><div class="avatar">${esc((p.nickname||'琴')[0])}</div><div><h3>${esc(p.title)}</h3><p>${esc(p.content)}</p><div class="postMeta"><span class="category">${esc(p.category)}</span><span>匿名琴友 · ${esc(p.nickname)}</span><span>${formatTime(p.createdAt)}</span></div></div><div class="replyCount">${count} 条回复</div></article>`}).join(''):'<div class="empty">这里还很安静。发第一篇帖子，等一位琴友回应。</div>';
    $$('.post').forEach(el=>el.onclick=()=>openThread(el.dataset.post));
  }

  function openThread(id){
    const p=posts.find(x=>String(idOf(x))===String(id));if(!p)return;
    $('#threadBody').innerHTML=`<p class="kicker">${esc(p.category)}</p><h2>${esc(p.title)}</h2><div class="postMeta"><span>匿名琴友 · ${esc(p.nickname)}</span><span>${formatTime(p.createdAt)}</span></div><p class="threadContent">${esc(p.content)}</p>`;
    const list=replies.filter(r=>String(r.postId)===String(id)).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    $('#replies').innerHTML=list.length?`<h3>${list.length} 条回复</h3>`+list.map((r,i)=>`<article class="reply"><b>${i+1} 楼 · ${esc(r.nickname)}</b><p>${esc(r.content)}</p><div class="replyMeta">${formatTime(r.createdAt)}</div></article>`).join(''):'<p class="empty">还没有回复，来认真回应第一句吧。</p>';
    $('#replyForm').elements.postId.value=id;$('#thread').hidden=false;
  }

  async function initCloud(){
    if(!config.env||!window.cloudbase){posts=readLocal(localPosts);replies=readLocal(localReplies);setStatus('腾讯云环境正在完成配置；当前浏览器可先体验完整发帖与回复功能。');render();return;}
    try{
      const app=cloudbase.init({env:config.env,region:config.region||'ap-shanghai'});
      await app.auth({persistence:'local'}).signInAnonymously();db=app.database();
      const load=async()=>{const [p,r]=await Promise.all([db.collection('forum_posts').orderBy('createdAt','desc').limit(100).get(),db.collection('forum_replies').orderBy('createdAt','asc').limit(500).get()]);posts=p.data||[];replies=r.data||[];render()};
      await load();setStatus('已连接腾讯云 · 所有国内访客可实时看到新帖子与回复','ok');
      watchers.push(db.collection('forum_posts').watch({onChange:s=>{posts=(s.docs||[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));render()},onError:()=>setStatus('实时连接暂时中断，正在使用最近数据','error')}));
      watchers.push(db.collection('forum_replies').watch({onChange:s=>{replies=s.docs||[];render();const id=$('#replyForm').elements.postId.value;if(!$('#thread').hidden&&id)openThread(id)},onError:()=>{}}));
    }catch(error){posts=readLocal(localPosts);replies=readLocal(localReplies);setStatus(`云端连接失败：${error.message||'请稍后重试'}`,'error');render()}
  }

  $('#openComposer').onclick=()=>$('#composer').hidden=false;
  $$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).hidden=true);
  $$('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)m.hidden=true});
  $$('.categories button').forEach(b=>b.onclick=()=>{$$('.categories button').forEach(x=>x.classList.remove('active'));b.classList.add('active');category=b.dataset.category;$('#feedTitle').textContent=category==='全部'?'全部帖子':category;render()});
  $('#search').oninput=render;
  $('#postForm').onsubmit=async e=>{e.preventDefault();const data=new FormData(e.currentTarget);const item={nickname:String(data.get('nickname')).trim(),category:String(data.get('category')),title:String(data.get('title')).trim(),content:String(data.get('content')).trim(),createdAt:now()};try{if(db)await db.collection('forum_posts').add(item);else{item.id=`post-${Date.now()}`;posts.unshift(item);localStorage.setItem(localPosts,JSON.stringify(posts));render()}e.currentTarget.reset();$('#composer').hidden=true;notify('帖子已发布，琴友现在可以看到它。')}catch(error){notify(`发布失败：${error.message||'请重试'}`)}};
  $('#replyForm').onsubmit=async e=>{e.preventDefault();const data=new FormData(e.currentTarget);const item={postId:String(data.get('postId')),nickname:String(data.get('nickname')).trim(),content:String(data.get('content')).trim(),createdAt:now()};try{if(db)await db.collection('forum_replies').add(item);else{item.id=`reply-${Date.now()}`;replies.push(item);localStorage.setItem(localReplies,JSON.stringify(replies));render();openThread(item.postId)}e.currentTarget.elements.nickname.value='';e.currentTarget.elements.content.value='';notify('回复成功。')}catch(error){notify(`回复失败：${error.message||'请重试'}`)}};
  window.addEventListener('beforeunload',()=>watchers.forEach(w=>w&&w.close&&w.close()));
  initCloud();
})();
