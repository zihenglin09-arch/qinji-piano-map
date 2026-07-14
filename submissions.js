const locationStoreKey='qinji-github-locations-v1';
const readStore=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback}catch{return fallback}};
const savedLocations=readStore(locationStoreKey,[]);
savedLocations.forEach(place=>{if(!pianos.some(item=>String(item.id)===String(place.id)))pianos.push(place)});

function refreshLocationUI(place){
  document.querySelector('#count').textContent=String(pianos.length);
  document.querySelector('#eventPiano').innerHTML=pianos.filter(item=>item.status!=='暂不可用').map(item=>`<option value="${item.id}">${esc(item.name)}</option>`).join('');
  render();
  if(place){show(place);map.setView([place.lat,place.lng],13);document.querySelector('#map').scrollIntoView({behavior:'smooth'});}
}

const locationForm=document.querySelector('#locationForm');
locationForm.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(locationForm);
  const cityName=String(data.get('city'));
  const place={
    id:`user-${Date.now()}`,
    name:String(data.get('name')).trim(),
    city:cityName,
    district:'用户提交',
    address:String(data.get('address')).trim(),
    type:'新地点',
    access:'待进一步核实',
    status:String(data.get('status')),
    hours:'以现场情况为准',
    note:String(data.get('note')).trim()||'由琴友提交的新地点，建议出发前再次确认。',
    lat:cityName==='深圳'?22.5431:23.1291,
    lng:cityName==='深圳'?114.0579:113.2644
  };
  const stored=readStore(locationStoreKey,[]);
  stored.push(place);
  localStorage.setItem(locationStoreKey,JSON.stringify(stored));
  pianos.push(place);
  locationForm.reset();
  refreshLocationUI(place);
  notify('新地点已加入地图和地点列表。');
});

const robustEventForm=document.querySelector('#eventForm');
robustEventForm.onsubmit=event=>{
  event.preventDefault();
  const data=new FormData(robustEventForm);
  const piano=pianos.find(item=>String(item.id)===String(data.get('pianoId')));
  if(!piano){notify('请选择一个有效的共享钢琴点。');return;}
  const item={id:`event-${Date.now()}`,title:String(data.get('title')).trim(),pianoName:piano.name,eventDate:String(data.get('eventDate')),eventTime:String(data.get('eventTime')),genre:String(data.get('genre')),hostName:String(data.get('hostName')).trim(),note:String(data.get('note')).trim(),participants:[]};
  events.push(item);
  saveEvents();
  renderEvents();
  robustEventForm.reset();
  document.querySelector('#eventModal').hidden=true;
  document.querySelector('#events').scrollIntoView({behavior:'smooth'});
  notify('活动已发布并加入活动列表。');
};

window.addEventListener('storage',event=>{
  if(event.key===eventStoreKey){events=readStore(eventStoreKey,[]);renderEvents();}
});

refreshLocationUI();
