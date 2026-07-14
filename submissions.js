(function(){
  const config=window.QINJI_CLOUDBASE||{};
  const locationStoreKey='qinji-github-locations-v1';
  const readStore=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback}catch{return fallback}};
  let db=null,locationWatcher=null,eventWatcher=null,registrationWatcher=null,cloudLocations=[],cloudEvents=[],registrations=[];
  const builtInLocations=pianos.filter(p=>Number.isInteger(p.id)&&p.id>=101&&p.id<=111);
  const normalizeLocations=docs=>(docs||[]).map((p,index)=>({...p,id:Number.isInteger(p.id)?p.id:100000+index}));
  const idOf=item=>item._id||item.id;
  const created=()=>new Date().toISOString();

  function mergeLocations(){
    pianos.splice(0,pianos.length,...builtInLocations,...cloudLocations);
  }
  function refreshLocationUI(place){
    document.querySelector('#count').textContent=String(pianos.length);
    document.querySelector('#eventPiano').innerHTML=pianos.filter(item=>item.status!=='暂不可用').map(item=>`<option value="${idOf(item)}">${esc(item.name)}</option>`).join('');
    render();if(place){show(place);map.setView([place.lat,place.lng],13);document.querySelector('#map').scrollIntoView({behavior:'smooth'});}
  }
  function mergeEvents(){
    events=cloudEvents.map(item=>({...item,id:String(idOf(item)),participants:registrations.filter(r=>String(r.eventId)===String(idOf(item))).map(r=>({name:r.participantName,repertoire:r.repertoire}))}));
    renderEvents();
  }
  async function connectCloud(){
    if(!config.env||!window.cloudbase){
      cloudLocations=readStore(locationStoreKey,[]);mergeLocations();refreshLocationUI();return;
    }
    try{
      const app=cloudbase.init({env:config.env,region:config.region||'ap-shanghai'});await app.auth({persistence:'local'}).signInAnonymously();db=app.database();
      const [l,e,r]=await Promise.all([db.collection('pianos').limit(100).get(),db.collection('events').orderBy('createdAt','desc').limit(100).get(),db.collection('registrations').limit(500).get()]);
      cloudLocations=normalizeLocations(l.data);cloudEvents=e.data||[];registrations=r.data||[];mergeLocations();refreshLocationUI();mergeEvents();
      locationWatcher=db.collection('pianos').watch({onChange:s=>{cloudLocations=normalizeLocations(s.docs);mergeLocations();refreshLocationUI()},onError:()=>notify('地点实时更新暂时中断，请刷新重试。')});
      eventWatcher=db.collection('events').watch({onChange:s=>{cloudEvents=s.docs||[];mergeEvents()},onError:()=>notify('活动实时更新暂时中断，请刷新重试。')});
      registrationWatcher=db.collection('registrations').watch({onChange:s=>{registrations=s.docs||[];mergeEvents()},onError:()=>{}});
    }catch(error){notify(`云端连接失败：${error.message||'请稍后刷新'}`);cloudLocations=readStore(locationStoreKey,[]);mergeLocations();refreshLocationUI();}
  }

  const locationForm=document.querySelector('#locationForm');
  locationForm.onsubmit=async event=>{
    event.preventDefault();const data=new FormData(locationForm),cityName=String(data.get('city'));
    const place={name:String(data.get('name')).trim(),city:cityName,district:'琴友提交',address:String(data.get('address')).trim(),type:'新地点',access:'待进一步核实',status:String(data.get('status')),hours:'以现场情况为准',note:String(data.get('note')).trim()||'由琴友提交的新地点，建议出发前再次确认。',lat:cityName==='深圳'?22.5431:23.1291,lng:cityName==='深圳'?114.0579:113.2644,createdAt:created()};
    try{if(db){await db.collection('pianos').add(place)}else{place.id=`user-${Date.now()}`;const stored=readStore(locationStoreKey,[]);stored.push(place);localStorage.setItem(locationStoreKey,JSON.stringify(stored));cloudLocations=stored;mergeLocations();refreshLocationUI(place)}locationForm.reset();notify(db?'新地点已提交到云端，所有访客都能看到。':'新地点已加入当前浏览器。')}catch(error){notify(`提交失败：${error.message||'请重试'}`)}
  };
  document.querySelector('#eventForm').onsubmit=async event=>{
    event.preventDefault();const data=new FormData(event.currentTarget),piano=pianos.find(item=>String(idOf(item))===String(data.get('pianoId')));if(!piano){notify('请选择一个有效的共享钢琴点。');return}
    const item={title:String(data.get('title')).trim(),pianoId:String(idOf(piano)),pianoName:piano.name,eventDate:String(data.get('eventDate')),eventTime:String(data.get('eventTime')),genre:String(data.get('genre')),hostName:String(data.get('hostName')).trim(),note:String(data.get('note')).trim(),createdAt:created()};
    try{if(db){await db.collection('events').add(item)}else{item.id=`event-${Date.now()}`;item.participants=[];events.push(item);saveEvents();renderEvents()}event.currentTarget.reset();document.querySelector('#eventModal').hidden=true;document.querySelector('#events').scrollIntoView({behavior:'smooth'});notify(db?'活动已发布到云端，琴友现在可以报名。':'活动已发布。')}catch(error){notify(`发布失败：${error.message||'请重试'}`)}
  };
  document.querySelector('#joinForm').onsubmit=async event=>{
    event.preventDefault();const data=new FormData(event.currentTarget),item=events.find(entry=>String(entry.id)===String(data.get('eventId')));if(!item)return;
    const registration={eventId:String(item.id),participantName:String(data.get('participantName')).trim(),repertoire:String(data.get('repertoire')).trim(),createdAt:created()};
    try{if(db){await db.collection('registrations').add(registration)}else{item.participants.push({name:registration.participantName,repertoire:registration.repertoire});saveEvents();renderEvents()}event.currentTarget.reset();document.querySelector('#joinModal').hidden=true;notify(db?'报名成功，信息已同步给所有琴友。':'报名成功，活动现场见！')}catch(error){notify(`报名失败：${error.message||'请重试'}`)}
  };
  window.addEventListener('beforeunload',()=>[locationWatcher,eventWatcher,registrationWatcher].forEach(w=>w&&w.close&&w.close()));
  connectCloud();
})();
