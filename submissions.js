const cloudApiBase='https://qinji-piano-map.zihenglin09.chatgpt.site';
const apiJson=async(path,options={})=>{
  const response=await fetch(`${cloudApiBase}${path}`,options);
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'云端服务暂时不可用');
  return body;
};

const normalizePiano=item=>({
  ...item,
  id:Number(item.id),
  type:item.venueType||item.type||'其他',
  lat:Number(item.lat),
  lng:Number(item.lng)
});
const normalizeEvent=item=>({
  ...item,
  id:String(item.id),
  pianoId:String(item.pianoId),
  participantCount:Number(item.participantCount||0),
  participants:String(item.participants||'').split('｜').filter(Boolean).map(value=>{
    const [name,...rest]=value.split('：');
    return {name,repertoire:rest.join('：')};
  })
});

function refreshLocationUI(place){
  document.querySelector('#count').textContent=String(pianos.length);
  document.querySelector('#eventPiano').innerHTML=pianos.filter(item=>item.status!=='暂不可用').map(item=>`<option value="${item.id}">${esc(item.name)}</option>`).join('');
  render();
  if(place){show(place);map.setView([place.lat,place.lng],13);document.querySelector('#map').scrollIntoView({behavior:'smooth'});}
}

async function syncCloudData(){
  try{
    const [cloudPianos,cloudEvents]=await Promise.all([apiJson('/api/pianos'),apiJson('/api/events')]);
    pianos.splice(0,pianos.length,...cloudPianos.map(normalizePiano));
    events=cloudEvents.map(normalizeEvent);
    selected=pianos[0]||selected;
    refreshLocationUI();
    if(selected)show(selected);
    renderEvents();
  }catch(error){
    notify('云端同步暂时不可用，请稍后刷新。');
  }
}

const locationForm=document.querySelector('#locationForm');
locationForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=new FormData(locationForm);
  const cityName=String(data.get('city'));
  const payload={
    name:String(data.get('name')).trim(),
    city:cityName,
    district:'用户提交',
    address:String(data.get('address')).trim(),
    venueType:'其他',
    hours:'以现场情况为准',
    note:String(data.get('note')).trim()||'由琴友提交的新地点，建议出发前再次确认。',
    lat:cityName==='深圳'?22.5431:23.1291,
    lng:cityName==='深圳'?114.0579:113.2644
  };
  try{
    const saved=normalizePiano(await apiJson('/api/pianos',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}));
    pianos.unshift(saved);
    locationForm.reset();
    refreshLocationUI(saved);
    notify('新地点已保存到云端，并同步到两个网站。');
  }catch(error){notify(error.message);}
});

const robustEventForm=document.querySelector('#eventForm');
robustEventForm.onsubmit=async event=>{
  event.preventDefault();
  const data=new FormData(robustEventForm);
  const piano=pianos.find(item=>String(item.id)===String(data.get('pianoId')));
  if(!piano){notify('请选择一个有效的共享钢琴点。');return;}
  const payload={title:String(data.get('title')).trim(),pianoId:Number(piano.id),pianoName:piano.name,eventDate:String(data.get('eventDate')),eventTime:String(data.get('eventTime')),genre:String(data.get('genre')),hostName:String(data.get('hostName')).trim(),note:String(data.get('note')).trim()};
  try{
    const saved=normalizeEvent(await apiJson('/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}));
    events.push(saved);
    renderEvents();
    robustEventForm.reset();
    document.querySelector('#eventModal').hidden=true;
    document.querySelector('#events').scrollIntoView({behavior:'smooth'});
    notify('活动已保存到云端，并同步到两个网站。');
  }catch(error){notify(error.message);}
};

openJoin=id=>{
  const item=events.find(event=>String(event.id)===String(id));
  if(!item)return;
  document.querySelector('#joinTitle').textContent=item.title;
  document.querySelector('#joinMeta').textContent=`${item.eventDate}　${item.eventTime}　${item.pianoName}`;
  document.querySelector('#joinForm').elements.eventId.value=item.id;
  document.querySelector('#joinModal').hidden=false;
};

document.querySelector('#joinForm').onsubmit=async event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const item=events.find(entry=>String(entry.id)===String(data.get('eventId')));
  if(!item)return;
  const participant={name:String(data.get('participantName')).trim(),repertoire:String(data.get('repertoire')).trim()||'待定'};
  try{
    await apiJson(`/api/events/${item.id}/register`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({participantName:participant.name,repertoire:participant.repertoire})});
    item.participants.push(participant);
    item.participantCount=item.participants.length;
    renderEvents();
    event.currentTarget.reset();
    document.querySelector('#joinModal').hidden=true;
    notify('报名已保存到云端，活动现场见！');
  }catch(error){notify(error.message);}
};

syncCloudData();
