import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         sendEmailVerification, sendPasswordResetEmail, onAuthStateChanged, signOut as fbSignOut,
         updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query,
         where, getDocs, arrayUnion, serverTimestamp, onSnapshot, deleteField }
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Mark Firebase as ready
window._fbReady = false;

const firebaseConfig = {
  apiKey: "AIzaSyCcemQInrgqkR28eNnDe0P-cJNnWBeNTJw",
  authDomain: "nba-bets-2026.firebaseapp.com",
  projectId: "nba-bets-2026",
  storageBucket: "nba-bets-2026.firebasestorage.app",
  messagingSenderId: "543075338360",
  appId: "1:543075338360:web:f9c378431cbf4305ba858d",
  measurementId: "G-49JMG7P5EY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser=null,currentUserDoc=null,currentLeague=null,currentLeagueData=null,leagueUnsubscribe=null,CBD={};
// bonusBetDraft: temp storage while admin edits bonus bets
let bonusBetDraft = {};

const STAGE_MATCHES={
  0:[{key:'e78',label:'מזרח: #7 מול #8',conf:'east'},{key:'e910',label:'מזרח: #9 מול #10',conf:'east'},
     {key:'w78',label:'מערב: #7 מול #8',conf:'west'},{key:'w910',label:'מערב: #9 מול #10',conf:'west'}],
  '0b':[{key:'e_final',label:'מזרח: גמר פליי-אין',conf:'east',singleGame:true},{key:'w_final',label:'מערב: גמר פליי-אין',conf:'west',singleGame:true}],
  1:[{key:'e1',label:"מזרח ס'1",conf:'east'},{key:'e2',label:"מזרח ס'2",conf:'east'},{key:'e3',label:"מזרח ס'3",conf:'east'},{key:'e4',label:"מזרח ס'4",conf:'east'},
     {key:'w1',label:"מערב ס'1",conf:'west'},{key:'w2',label:"מערב ס'2",conf:'west'},{key:'w3',label:"מערב ס'3",conf:'west'},{key:'w4',label:"מערב ס'4",conf:'west'}],
  2:[{key:'e1',label:"מזרח ס'1",conf:'east'},{key:'e2',label:"מזרח ס'2",conf:'east'},{key:'w1',label:"מערב ס'1",conf:'west'},{key:'w2',label:"מערב ס'2",conf:'west'}],
  3:[{key:'east',label:'גמר מזרח',conf:'east',hasMvp:true},{key:'west',label:'גמר מערב',conf:'west',hasMvp:true}],
  4:[{key:'finals',label:'גמר NBA',conf:'',hasMvp:true}]
};
const STAGE_NAMES=['פליי-אין סיבוב א (4 משחקים)','פליי-אין גמר (2 משחקים)','סיבוב ראשון','סיבוב שני','גמר איזורי','גמר NBA'];
const STAGE_SHORT=['פליי-אין א','פליי-אין ב','סיבוב 1','סיבוב 2','גמר איזורי','גמר'];
const GAPS=['4-0','4-1','4-2','4-3'];
const PREBETS=[{key:'champion',label:'🏆 אלוף NBA'},{key:'east_champ',label:'🔵 אלופת המזרח'},{key:'west_champ',label:'🔴 אלופת המערב'}];

// ── STAGE KEYS (ordered) ──
const STAGE_KEYS=[0,'0b',1,2,3,4];
const SUPER_ADMIN_UID='aPgbjXex6lbB7N4X5j62Y4qqECV2';
function isSuperAdmin(){return currentUser&&currentUser.uid===SUPER_ADMIN_UID;}
function hasStageResults(si){
  const r=getGlobal('results',{});
  const stageR=r['stage'+si];
  if(!stageR)return false;
  return Object.values(stageR).some(v=>v&&v!=='');
}

function canBetOnStage(si){
  // Can always bet on stage 0 (playin round 1)
  if(si===0)return true;
  // For stage 0b (playin finals), need stage 0 results
  if(si==='0b')return hasStageResults(0);
  // For stage 1, need stage 0b results
  if(si===1)return hasStageResults('0b');
  // For stages 2-4, need previous stage results
  const prev={2:1,3:2,4:3};
  if(prev[si]!==undefined)return hasStageResults(prev[si]);
  return true;
}

function isSeriesLocked(si,mk){return !!(getGlobal('seriesLocked',{})[si+'_'+mk]);}
function getSeriesLockedKey(si,mk){return si+'_'+mk;}
// Bonus is locked when stage 0 (first playin) is locked
function isBonusLocked(si){
  // Bonus for playin (stage0/0b) is locked with stage0
  // Bonus for other stages is locked with their own stage
  const lockIdx = (si===0||si==='0b') ? 0 : STAGE_KEYS.indexOf(si);
  return (getGlobal('stageLocked',[]))[lockIdx]||false;
}
function isSingleBonusLocked(si,bonus){
  // If bonus has a seriesKey, it's locked with that series
  if(bonus.seriesKey)return isSeriesLocked(si,bonus.seriesKey);
  // Otherwise locked with the stage
  return isBonusLocked(si);
}
function isPreBetsLocked(){
  // Pre-bets locked when any series in stage 1 is locked
  const sl=getGlobal('seriesLocked',{});
  return Object.keys(sl).some(k=>k.startsWith('1_')&&sl[k]);
}
// Get auto-computed teams for 0b finals based on stage0 results
function getPlayinFinalTeams(conf){
  const r0=(getGlobal('results',{}))['stage0']||{};
  // Try to get teams from globalData - handle both nested and flat storage
  const teamsGlobal=getGlobal('teams',{});
  const t0=teamsGlobal['stage0']||teamsGlobal||{};
  const k78=conf==='east'?'e78':'w78';
  const k910=conf==='east'?'e910':'w910';
  // Get team names - try nested first, then flat
  const match78=t0[k78]||{};
  const home78=match78.home||'', away78=match78.away||'';
  const winner78=(r0[k78]||'').toLowerCase().trim();
  let loser78='';
  if(winner78&&home78&&away78){
    loser78=winner78===home78.toLowerCase().trim()?away78:home78;
  } else if(winner78&&home78){
    // If we have winner and one team name, try to figure out loser
    loser78=winner78===home78.toLowerCase().trim()?away78:home78;
  }
  // winner of 9v10
  const winner910=r0[k910]||'';
  return {home: loser78||'מפסידת #7מול8', away: winner910||'מנצחת #9מול10'};
}
// bonus bets for playin use key 'stage0bonus' (shared for both playin stages)
function getBonusStageKey(si){return(si===0||si==='0b')?'stage0':('stage'+si);}
function getResultsKey(si){return 'stage'+si;}

// ── EXPOSE ALL FUNCTIONS TO WINDOW ──
window.switchAuthTab=switchAuthTab;
window.doLogin=doLogin;
window.doRegister=doRegister;
window.doResetPassword=doResetPassword;
window.doResendVerification=doResendVerification;
window.doSignOut=doSignOut;
window.goHome=goHome;
window.showPage=showPage;
window.createLeague=createLeague;
window.joinLeague=joinLeague;
window.loadMyLeagues=loadMyLeagues;
window.enterCreatedLeague=enterCreatedLeague;
window.copyLink=copyLink;
window.copyAdminLink=copyAdminLink;
window.showLeagueTab=showLeagueTab;
window.viewStage=viewStage;
window.renderBetForm=renderBetForm;
window.pickPlayin=pickPlayin;
window.pickSeries=pickSeries;
window.pickBonus=pickBonus;
window.saveBet=saveBet;
window.renderTeamSetupForm=renderTeamSetupForm;
window.saveTeamSetup=saveTeamSetup;
window.renderResultForm=renderResultForm;
window.saveResults=saveResults;
window.setCurrentStage=setCurrentStage;
window.toggleStageLock=toggleStageLock;
window.openLeague=openLeague;
window.toggleMenu=toggleMenu;
window.closeMenu=closeMenu;
window.addBonusBet=addBonusBet;
window.updateBonusQuestion=updateBonusQuestion;
window.updateBonusPoints=updateBonusPoints;
window.updateBonusAnswer=updateBonusAnswer;
window.removeBonusBet=removeBonusBet;
window.addBonusAnswer=addBonusAnswer;
window.removeBonusAnswer=removeBonusAnswer;
window.saveBonusBets=saveBonusBets;
window.renderBonusAdmin=renderBonusAdmin;
window.closeMenuAnd=closeMenuAnd;
window.showNextBonus=showNextBonus;
window.addAutoLock=addAutoLock;
window.removeAutoLock=removeAutoLock;
window._fbReady=true;
// Trigger pending calls
if(window._pendingCalls){window._pendingCalls.forEach(fn=>fn());window._pendingCalls=[];}

// ── MENU ──
function toggleMenu(){document.getElementById('menuDropdown').classList.toggle('open');}
function closeMenu(){document.getElementById('menuDropdown').classList.remove('open');}
function closeMenuAnd(fn){closeMenu();if(currentLeague&&fn===loadMyLeagues){fn();}else{fn();}}
document.addEventListener('click',e=>{
  if(!document.getElementById('menuBtn').contains(e.target)&&!document.getElementById('menuDropdown').contains(e.target))closeMenu();
});

// ── AUTH STATE ──
onAuthStateChanged(auth, async user=>{
  if(user){
    currentUser=user;
    const uSnap=await getDoc(doc(db,'users',user.uid));
    currentUserDoc=uSnap.exists()?uSnap.data():{displayName:user.displayName,username:user.email};
    const uname=currentUserDoc.username||user.email;
    document.getElementById('menuUsername').textContent='👤 '+uname;
    document.getElementById('mainHeader').style.display='';
    if(isSuperAdmin()){
      const saBtn=document.getElementById('superAdminHomeBtn');
      const saMenu=document.getElementById('menuGlobalAdmin');
      if(saBtn)saBtn.style.display='';
      if(saMenu)saMenu.style.display='';
    }
    const params=new URLSearchParams(location.search);
    const code=params.get('code');
    startAutoLockChecker();
    // Start global listener immediately at login and wait for first load
    if(!globalUnsubscribe){
      await new Promise(resolve=>{
        globalUnsubscribe=onSnapshot(doc(db,'global','settings'),snap=>{
          globalData=snap.exists()?snap.data():{};
          resolve(); // resolve on first load
          // Re-render current league page if open
          if(currentLeagueData){
            const activePage=document.querySelector('.page.active');
            if(activePage&&activePage.id==='page-league')renderLeaguePage();
          }
        });
      });
    }
    if(code){await autoJoinLeague(code);}else{goHome();}
  } else {
    currentUser=null;currentUserDoc=null;
    document.getElementById('mainHeader').style.display='none';
    showPage('page-auth');
  }
});

// ── AUTH ──
function switchAuthTab(t){
  document.querySelectorAll('.auth-tab').forEach((b,i)=>b.classList.toggle('active',(i===0&&t==='login')||(i===1&&t==='register')));
  document.getElementById('authLogin').style.display=t==='login'?'':'none';
  document.getElementById('authRegister').style.display=t==='register'?'':'none';
}
async function doLogin(){
  const email=document.getElementById('loginEmail').value.trim(),pw=document.getElementById('loginPassword').value;
  if(!email||!pw){toast('⚠️ מלא את כל השדות');return;}
  try{
    const cred=await signInWithEmailAndPassword(auth,email,pw);
    if(!cred.user.emailVerified){await fbSignOut(auth);toast('📧 יש לאמת את האימייל תחילה');return;}
  }catch(e){toast('❌ '+(e.code==='auth/invalid-credential'?'אימייל או סיסמה שגויים':e.message));}
}
async function doRegister(){
  const name=document.getElementById('regName').value.trim();
  const username=document.getElementById('regUsername').value.trim().replace(/\s/g,'');
  const email=document.getElementById('regEmail').value.trim();
  const pw=document.getElementById('regPassword').value;
  if(!name||!username||!email||!pw){toast('⚠️ מלא את כל השדות');return;}
  if(pw.length<6){toast('⚠️ סיסמה חייבת להיות לפחות 6 תווים');return;}
  try{
    const uQ=await getDocs(query(collection(db,'users'),where('username','==',username)));
    if(!uQ.empty){toast('⚠️ שם המשתמש תפוס');return;}
    const cred=await createUserWithEmailAndPassword(auth,email,pw);
    await updateProfile(cred.user,{displayName:name});
    await setDoc(doc(db,'users',cred.user.uid),{uid:cred.user.uid,displayName:name,username,email,createdAt:serverTimestamp()});
    await sendEmailVerification(cred.user);
    await fbSignOut(auth);
    toast('📧 נשלח מייל אימות! אמת ואז התחבר');
    switchAuthTab('login');
  }catch(e){toast('❌ '+(e.code==='auth/email-already-in-use'?'אימייל כבר קיים':e.message));}
}
async function doResetPassword(){
  const email=document.getElementById('loginEmail').value.trim();
  if(!email){toast('⚠️ הכנס אימייל תחילה');return;}
  try{await sendPasswordResetEmail(auth,email);toast('📧 קישור לאיפוס נשלח! בדוק גם ספאם');}
  catch(e){toast('❌ '+e.message);}
}
async function doResendVerification(){
  const email=document.getElementById('regEmail').value.trim(),pw=document.getElementById('regPassword').value;
  if(!email||!pw){toast('⚠️ הכנס אימייל וסיסמה');return;}
  try{
    const cred=await signInWithEmailAndPassword(auth,email,pw);
    if(cred.user.emailVerified){toast('✅ האימייל כבר מאומת!');await fbSignOut(auth);return;}
    await sendEmailVerification(cred.user);await fbSignOut(auth);
    toast('📧 מייל אימות נשלח שוב! בדוק ספאם');
  }catch(e){toast('❌ '+(e.code==='auth/invalid-credential'?'אימייל או סיסמה שגויים':e.message));}
}
function openGlobalAdmin(){
  if(!isSuperAdmin()){toast('⛔ אין גישה');return;}
  showPage('page-global-admin');
  renderGlobalAdmin();
}
window.openGlobalAdmin=openGlobalAdmin;

function renderGlobalAdmin(){
  const content=document.getElementById('global-admin-content');
  if(!content)return;
  // Build the same admin content but standalone
  // Current stage info
  const csIdx=STAGE_KEYS.indexOf(getGlobal('currentStage',0));
  const sl=getGlobal('stageLocked',[false,false,false,false,false,false]);
  
  let html=`
  <div class="card">
    <div class="card-title">🔄 ניהול שלבים</div>
    <div class="info-box"><strong>שלב נוכחי:</strong> ${STAGE_NAMES[csIdx]||''} ${sl[csIdx]?'🔒':'🟢'}</div>
    <div id="allStageLockStatus2" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
      ${STAGE_SHORT.map((s,i)=>`<span style="padding:3px 8px;border-radius:6px;font-size:0.75rem;border:1px solid ${sl[i]?'var(--green)':'var(--border)'};color:${sl[i]?'var(--green)':'var(--text2)'}">${s} ${sl[i]?'🔒':'🔓'}</span>`).join('')}
    </div>
    <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:12px">
      <select id="gaAdminStageSelect" style="padding:8px 11px;background:var(--dark3);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.86rem;">
        <option value="0">פליי-אין סיבוב א</option><option value="0b">פליי-אין גמר</option>
        <option value="1">סיבוב ראשון</option><option value="2">סיבוב שני</option>
        <option value="3">גמר איזורי</option><option value="4">גמר NBA</option>
      </select>
      <button class="btn btn-secondary btn-sm" onclick="gaSetCurrentStage()">עדכן שלב</button>
      <button class="btn btn-secondary btn-sm" onclick="gaToggleStageLock()">🔒 נעל/פתח</button>
    </div>
  </div>

  <div class="card">
    <div class="card-title">🏀 הגדרת קבוצות</div>
    <select id="gaTeamStageSelect" onchange="gaRenderTeamSetup()" style="padding:8px 11px;background:var(--dark3);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.86rem;margin-bottom:12px">
      <option value="0">פליי-אין סיבוב א</option><option value="0b">פליי-אין גמר</option>
      <option value="1">סיבוב ראשון</option><option value="2">סיבוב שני</option>
      <option value="3">גמר איזורי</option><option value="4">גמר NBA</option>
    </select>
    <div id="gaTeamSetupForm"></div>
  </div>

  <div class="card">
    <div class="card-title">📊 הזן תוצאות</div>
    <select id="gaResultStageSelect" onchange="gaRenderResultForm()" style="padding:8px 11px;background:var(--dark3);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.86rem;margin-bottom:12px">
      <option value="0">פליי-אין סיבוב א</option><option value="0b">פליי-אין גמר</option>
      <option value="1">סיבוב ראשון</option><option value="2">סיבוב שני</option>
      <option value="3">גמר איזורי</option><option value="4">גמר NBA</option>
    </select>
    <div id="gaResultFormContent"></div>
  </div>

  <div class="card">
    <div class="card-title">⭐ הימורי בונוס</div>
    <select id="gaBonusStageSelect" onchange="gaRenderBonusAdmin()" style="padding:8px 11px;background:var(--dark3);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.86rem;margin-bottom:12px">
      <option value="0">פליי-אין (כל השלב)</option>
      <option value="1">סיבוב ראשון</option><option value="2">סיבוב שני</option>
      <option value="3">גמר איזורי</option><option value="4">גמר NBA</option>
    </select>
    <div id="gaBonusAdminList"></div>
    <button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="gaAddBonusBet()">➕ הוסף הימור בונוס</button>
  </div>

  <div class="card">
    <div class="card-title">⏰ נעילה אוטומטית</div>
    <div id="gaAutoLockList" style="margin-bottom:10px"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
      <div>
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:4px">סוג</div>
        <select id="gaAutoLockType" onchange="updateAutoLockTargetsGA()" style="padding:7px 10px;background:var(--dark);border:1.5px solid var(--border);border-radius:7px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.82rem;">
          <option value="stage">שלב</option><option value="series">סדרה</option>
        </select>
      </div>
      <div>
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:4px">יעד</div>
        <select id="gaAutoLockTarget" style="padding:7px 10px;background:var(--dark);border:1.5px solid var(--border);border-radius:7px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.82rem;">
          <option value="0">פליי-אין א</option><option value="0b">פליי-אין גמר</option>
          <option value="1">סיבוב ראשון</option><option value="2">סיבוב שני</option>
          <option value="3">גמר איזורי</option><option value="4">גמר NBA</option>
        </select>
      </div>
      <div>
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:4px">תאריך ושעה</div>
        <input type="datetime-local" id="gaAutoLockTime" style="padding:7px 10px;background:var(--dark);border:1.5px solid var(--border);border-radius:7px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.82rem;">
      </div>
      <button class="btn btn-secondary btn-sm" onclick="gaAddAutoLock()" style="background:rgba(255,215,0,0.1);border-color:rgba(255,215,0,0.3);color:var(--gold)">➕ הוסף</button>
    </div>
  </div>

  <div class="card">
    <div class="card-title">📧 שליחת תזכורת</div>
    <div style="color:var(--text2);font-size:0.82rem;margin-bottom:10px">שלח מייל תזכורת לכל המשתתפים</div>
    <button class="btn btn-secondary btn-sm" onclick="sendReminderEmailGA()" style="background:rgba(79,195,247,0.1);border-color:rgba(79,195,247,0.3);color:var(--blue)">📧 פתח מייל תזכורת</button>
  </div>

  <div class="card">
    <div class="card-title">📡 תוצאות NBA חיות</div>
    <div style="color:var(--text2);font-size:0.82rem;margin-bottom:10px">שלוף תוצאות ממשחקים שהסתיימו ולחץ להחיל</div>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
      <input type="date" id="espnDatePicker" style="padding:7px 10px;background:var(--dark);border:1.5px solid var(--border);border-radius:7px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.82rem;">
      <button class="btn btn-secondary btn-sm" onclick="fetchESPNScores()" style="background:rgba(79,195,247,0.1);border-color:rgba(79,195,247,0.3);color:var(--blue)">📡 שלוף תוצאות</button>
    </div>
    <div id="espnScoresList"><div style="color:var(--text2);font-size:0.82rem">בחר תאריך ולחץ שלוף</div></div>
  </div>`;
  
  content.innerHTML=html;
  gaRenderTeamSetup();
  gaRenderResultForm();
  gaRenderBonusAdmin();
  gaRenderAutoLockList();
  // Set today's date in ESPN picker
  const dp=document.getElementById('espnDatePicker');
  if(dp){const today=new Date();const y=today.getFullYear();const m=String(today.getMonth()+1).padStart(2,'0');const d=String(today.getDate()).padStart(2,'0');dp.value=`${y}-${m}-${d}`;}
}
window.renderGlobalAdmin=renderGlobalAdmin;

// Global admin functions - wrappers that use the same underlying functions
async function gaSetCurrentStage(){
  const sv=document.getElementById('gaAdminStageSelect').value;
  const s=sv==='0b'?'0b':parseInt(sv);
  await setDoc(doc(db,'global','settings'),{currentStage:s},{merge:true});
  toast('✅ שלב עודכן!');renderGlobalAdmin();
}
async function gaToggleStageLock(){
  const sv=document.getElementById('gaAdminStageSelect').value;
  const s=sv==='0b'?'0b':parseInt(sv);
  const sIdx=STAGE_KEYS.indexOf(s);
  const newLocked=[...(getGlobal('stageLocked',[false,false,false,false,false,false]))];
  while(newLocked.length<6)newLocked.push(false);
  newLocked[sIdx]=!newLocked[sIdx];
  await setDoc(doc(db,'global','settings'),{stageLocked:newLocked},{merge:true});
  toast(newLocked[sIdx]?'🔒 ננעל':'🔓 נפתח');renderGlobalAdmin();
}
function gaRenderTeamSetup(){
  const tsiRaw=document.getElementById('gaTeamStageSelect')?.value;
  if(!tsiRaw)return;
  const si=tsiRaw==='0b'?'0b':parseInt(tsiRaw);
  const matches=STAGE_MATCHES[si],form=document.getElementById('gaTeamSetupForm');
  if(!form)return;
  let html='';
  if(si==='0b'){html='<div class="info-box">🔄 קבוצות מחושבות אוטומטית מתוצאות שלב א</div>';}
  else{
    for(const m of matches){
      const t=getTeams(si,m.key);
      const sLk=isSeriesLocked(si,m.key);
      html+=`<div style="border:1px solid ${sLk?'rgba(0,230,118,0.25)':'var(--border)'};border-radius:8px;padding:8px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:0.82rem;color:var(--text2)">${m.label}</span>
          <button data-si="${si}" data-mk="${m.key}" onclick="toggleSeriesLock(this.dataset.si,this.dataset.mk);setTimeout(gaRenderTeamSetup,500)"
            style="padding:3px 10px;border-radius:6px;border:1px solid ${sLk?'var(--green)':'var(--border)'};background:${sLk?'rgba(0,230,118,0.15)':'transparent'};color:${sLk?'var(--green)':'var(--text2)'};cursor:pointer;font-size:0.75rem">
            ${sLk?'🔒 נעול':'🔓 נעל'}
          </button>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <input class="ts-inp" id="ga_ts_${m.key}_home" value="${t.home}" placeholder="ביתית..." style="flex:1">
          <span class="vs-badge">מול</span>
          <input class="ts-inp" id="ga_ts_${m.key}_away" value="${t.away}" placeholder="אורחת..." style="flex:1">
        </div>
      </div>`;
    }
    html+=`<button class="btn btn-secondary btn-sm" style="margin-top:9px" onclick="gaSaveTeamSetup()">💾 שמור קבוצות</button>`;
  }
  form.innerHTML=html;
}
window.gaRenderTeamSetup=gaRenderTeamSetup;
async function gaSaveTeamSetup(){
  const tsiRaw=document.getElementById('gaTeamStageSelect')?.value;
  if(!tsiRaw)return;
  const si=tsiRaw==='0b'?'0b':parseInt(tsiRaw);
  const stageTeams={};
  for(const m of STAGE_MATCHES[si]||[]){
    const h=document.getElementById('ga_ts_'+m.key+'_home');
    const a=document.getElementById('ga_ts_'+m.key+'_away');
    stageTeams[m.key]={home:h?h.value.trim():'',away:a?a.value.trim():''};
  }
  const currentTeams=getGlobal('teams',{});
  const newTeams={...currentTeams,[`stage${si}`]:stageTeams};
  await setDoc(doc(db,'global','settings'),{teams:newTeams},{merge:true});
  toast('✅ קבוצות נשמרו!');
}
window.gaSaveTeamSetup=gaSaveTeamSetup;
function gaRenderResultForm(){
  const siRaw=document.getElementById('gaResultStageSelect')?.value;
  if(!siRaw)return;
  const si=siRaw==='0b'?'0b':parseInt(siRaw);
  // Reuse existing renderResultForm logic by temporarily swapping the element
  const content=document.getElementById('gaResultFormContent');
  if(!content)return;
  const matches=STAGE_MATCHES[si];
  const result=(getGlobal('results',{}))['stage'+si]||{};
  let html='';
  if(si===0||si==='0b'){
    for(const m of matches){
      let lbl,opts;
      if(si==='0b'){const ft=getPlayinFinalTeams(m.conf);lbl=m.label;opts=[ft.home,ft.away].filter(Boolean);if(!opts.length)opts=['מפסידת #7מול8','מנצחת #9מול10'];}
      else{const t=getTeams(si,m.key);lbl=t.home&&t.away?`${t.home} מול ${t.away}`:m.label;opts=[t.home||'קבוצה 1',t.away||'קבוצה 2'];}
      html+=`<div class="form-group"><label>🏀 ${lbl}</label><select id="ga_res_${m.key}"><option value="">בחר מנצחת...</option>${opts.map(o=>`<option value="${o}" ${result[m.key]===o?'selected':''}>${o}</option>`).join('')}</select></div>`;
    }
  } else {
    for(const m of matches){
      const t=getTeams(si,m.key),home=t.home||'ביתית',away=t.away||'אורחת';
      const lbl=t.home&&t.away?`${home} מול ${away}`:m.label;
      const allOpts=[...GAPS.map(r=>({w:home,r,l:`${home} ${r}`})),...GAPS.map(r=>({w:away,r,l:`${away} ${r}`}))];
      const curV=result[m.key+'_winner']&&result[m.key+'_result']?`${result[m.key+'_winner']}|${result[m.key+'_result']}`:'';
      html+=`<div class="form-group"><label>🏀 ${lbl}</label><select id="ga_res_${m.key}"><option value="">בחר תוצאה...</option>${allOpts.map(o=>{const v=`${o.w}|${o.r}`;return`<option value="${v}" ${curV===v?'selected':''}>${o.l}</option>`;}).join('')}</select></div>`;
      if(m.hasMvp)html+=`<div class="form-group"><label>🏅 MVP</label><input type="text" id="ga_res_${m.key}_mvp" value="${result[m.key+'_mvp']||''}" placeholder="שם שחקן..."></div>`;
    }
    if(si===4){
      const r1=(getGlobal('results',{}))['stage1']||{};
      const allS1=[...STAGE_MATCHES[1]];
      const eastT=[],westT=[];
      for(const m of allS1){const t=getTeams(1,m.key);if(m.conf==='east'){if(t.home)eastT.push(t.home);if(t.away)eastT.push(t.away);}else{if(t.home)westT.push(t.home);if(t.away)westT.push(t.away);}}
      const allT=[...eastT,...westT];
      const mkS=(teams,cur)=>teams.map(t=>`<option value="${t}" ${cur===t?'selected':''}>${t}</option>`).join('');
      html+=`<div class="separator"></div><div style="font-weight:700;color:var(--orange);margin:12px 0 9px">🏆 תוצאות הימורי מראש</div>`;
      html+=`<div class="form-group"><label>🏆 אלוף NBA</label><select id="ga_res_champion"><option value="">בחר...</option>${mkS(allT,r1.champion||'')}</select></div>`;
      html+=`<div class="form-group"><label>🔵 אלופת המזרח</label><select id="ga_res_east_champ"><option value="">בחר...</option>${mkS(eastT,r1.east_champ||'')}</select></div>`;
      html+=`<div class="form-group"><label>🔴 אלופת המערב</label><select id="ga_res_west_champ"><option value="">בחר...</option>${mkS(westT,r1.west_champ||'')}</select></div>`;
    }
  }
  const bonuses=getBonusBets(si),bonusResults=getBonusResults(si);
  if(bonuses.length){
    html+=`<div class="separator"></div><div style="font-weight:700;color:var(--gold);margin-bottom:9px">⭐ תוצאות הימורי בונוס</div>`;
    for(const b of bonuses){
      const opts=b.answers||[];
      html+=`<div class="form-group"><label>${b.question} (${b.points} נק')</label>
        <select id="ga_bres_${b.id}">
          <option value="" ${!bonusResults[b.id]?'selected':''}>בחר תשובה נכונה...</option>
          ${opts.map(a=>`<option value="${a}" ${bonusResults[b.id]===a&&bonusResults[b.id]!==''?'selected':''}>${a}</option>`).join('')}
        </select></div>`;
    }
  }
  html+=`<button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="gaSaveResults()">💾 שמור תוצאות</button>`;
  content.innerHTML=html;
}
window.gaRenderResultForm=gaRenderResultForm;
async function gaSaveResults(){
  const siRaw=document.getElementById('gaResultStageSelect')?.value;
  if(!siRaw)return;
  const si=siRaw==='0b'?'0b':parseInt(siRaw);
  const matches=STAGE_MATCHES[si];
  let result={};
  if(si===0){for(const m of matches){const el=document.getElementById('ga_res_'+m.key);if(el&&el.value)result[m.key]=el.value;}}
  else if(si==='0b'){for(const m of matches){const el=document.getElementById('ga_res_'+m.key);if(el&&el.value)result[m.key]=el.value;}}
  else{
    for(const m of matches){
      const el=document.getElementById('ga_res_'+m.key);
      if(el&&el.value){const p=el.value.split('|');result[m.key+'_winner']=p[0];if(p[1]!==undefined)result[m.key+'_result']=p[1];}
      if(m.hasMvp){const e2=document.getElementById('ga_res_'+m.key+'_mvp');if(e2)result[m.key+'_mvp']=e2.value.trim();}
    }
  }
  const resultToSave=Object.keys(result).length>0?result:null;
  const bonusResults={};
  const bonuses=getBonusBets(si);
  const bKey2=getBonusStageKey(si);
  for(const b of bonuses){
    const el=document.getElementById('ga_bres_'+b.id);
    if(el){bonusResults[b.id]=el.value||'';}
  }
  await setDoc(doc(db,'global','settings'),{results:{['stage'+si]:resultToSave}},{merge:true});
  if(bonuses.length){
    const bonusUpdates={};
    for(const b of bonuses){
      if(bonusResults[b.id])bonusUpdates[`bonusResults.${bKey2}.${b.id}`]=bonusResults[b.id];
      else bonusUpdates[`bonusResults.${bKey2}.${b.id}`]=deleteField();
    }
    if(Object.keys(bonusUpdates).length)await updateDoc(doc(db,'global','settings'),bonusUpdates);
  }
  // Auto-lock the stage when results saved
  if(resultToSave){
    const sIdx=STAGE_KEYS.indexOf(si);
    if(sIdx>=0){
      const newLocked=[...(getGlobal('stageLocked',[false,false,false,false,false,false]))];
      while(newLocked.length<6)newLocked.push(false);
      newLocked[sIdx]=true;
      await setDoc(doc(db,'global','settings'),{stageLocked:newLocked},{merge:true});
    }
  }
  // Pre-bets at stage 4
  if(si===4){
    const r1update={};
    const champEl=document.getElementById('ga_res_champion');
    const eastEl=document.getElementById('ga_res_east_champ');
    const westEl=document.getElementById('ga_res_west_champ');
    if(champEl)r1update.champion=champEl.value;
    if(eastEl)r1update.east_champ=eastEl.value;
    if(westEl)r1update.west_champ=westEl.value;
    if(Object.keys(r1update).length){
      const existing1=(getGlobal('results',{}))['stage1']||{};
      await setDoc(doc(db,'global','settings'),{results:{stage1:{...existing1,...r1update}}},{merge:true});
    }
  }
  toast('✅ תוצאות נשמרו!');
  gaRenderResultForm();
}
window.gaSaveResults=gaSaveResults;
function gaRenderBonusAdmin(){
  const bsiRaw=document.getElementById('gaBonusStageSelect')?.value;
  if(!bsiRaw)return;
  const si=bsiRaw==='0b'?'0b':parseInt(bsiRaw);
  const bKey=getBonusStageKey(si);
  const bonuses=getGlobal('bonusBets',{})[bKey]||[];
  bonusBetDraft['ga_'+si]=JSON.parse(JSON.stringify(bonuses));
  const list=document.getElementById('gaBonusAdminList');
  if(!list)return;
  if(!bonuses.length){list.innerHTML='<div style="color:var(--text2);font-size:0.82rem">אין הימורי בונוס</div>';return;}
  list.innerHTML=bonuses.map((b,i)=>{
    const answers=b.answers||[];
    const ansHtml=answers.map((a,ai)=>`<div class="bonus-answer-row">
      <input type="text" value="${a}" placeholder="תשובה..." data-si="ga_${si}" data-idx="${i}" data-aidx="${ai}" onchange="updateBonusAnswer(this.dataset.si,this.dataset.idx,this.dataset.aidx,this.value)">
      <button class="remove-ans" onclick="gaRemoveBonusAnswer(${i},${ai})">✕</button>
    </div>`).join('');
    return`<div class="bonus-admin-card">
      <button class="remove-btn" onclick="gaRemoveBonusBet(${i})">✕ הסר</button>
      <div class="form-group" style="margin-bottom:8px"><label>שאלה</label>
        <input type="text" value="${b.question}" placeholder="השאלה..." style="background:var(--dark);border:1.5px solid rgba(255,215,0,0.3);border-radius:7px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.84rem;padding:7px 10px;width:100%" data-si="ga_${si}" data-idx="${i}" onchange="updateBonusQuestion(this.dataset.si,this.dataset.idx,this.value)">
      </div>
      <div class="form-group" style="margin-bottom:8px"><label>נקודות</label>
        <input type="number" value="${b.points}" min="0.5" step="0.5" style="background:var(--dark);border:1.5px solid rgba(255,215,0,0.3);border-radius:7px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.84rem;padding:7px 10px;width:100px" data-si="ga_${si}" data-idx="${i}" onchange="updateBonusPoints(this.dataset.si,this.dataset.idx,this.value)">
      </div>
      <label style="font-size:0.78rem;color:var(--text2);font-weight:600;display:block;margin-bottom:6px">תשובות אפשריות</label>
      <div class="bonus-answers">${ansHtml}</div>
      <button class="btn-ghost" style="margin-top:8px;font-size:0.78rem" onclick="gaAddBonusAnswer(${i})">➕ הוסף תשובה</button>
    </div>`;
  }).join('');
  list.insertAdjacentHTML('beforeend',`<button class="btn btn-primary" style="margin-top:10px" onclick="gaSaveBonusBets()">💾 שמור הימורי בונוס</button>`);
}
window.gaRenderBonusAdmin=gaRenderBonusAdmin;
function gaGetSi(){const r=document.getElementById('gaBonusStageSelect')?.value;return r==='0b'?'0b':parseInt(r);}
function gaAddBonusBet(){const si=gaGetSi();if(!bonusBetDraft['ga_'+si])bonusBetDraft['ga_'+si]=[];bonusBetDraft['ga_'+si].push({id:'b'+Date.now(),question:'',points:1,answers:['',''],seriesKey:''});gaRenderBonusAdmin();}
function gaRemoveBonusBet(i){const si=gaGetSi();bonusBetDraft['ga_'+si].splice(i,1);gaRenderBonusAdmin();}
function gaAddBonusAnswer(i){const si=gaGetSi();bonusBetDraft['ga_'+si][i].answers.push('');gaRenderBonusAdmin();}
function gaRemoveBonusAnswer(i,ai){const si=gaGetSi();bonusBetDraft['ga_'+si][i].answers.splice(ai,1);gaRenderBonusAdmin();}
window.gaAddBonusBet=gaAddBonusBet;window.gaRemoveBonusBet=gaRemoveBonusBet;window.gaAddBonusAnswer=gaAddBonusAnswer;window.gaRemoveBonusAnswer=gaRemoveBonusAnswer;
async function gaSaveBonusBets(){
  const si=gaGetSi();
  const bonuses=bonusBetDraft['ga_'+si]||[];
  const bKey=getBonusStageKey(si);
  await setDoc(doc(db,'global','settings'),{bonusBets:{[bKey]:bonuses}},{merge:true});
  toast('✅ הימורי בונוס נשמרו!');
}
window.gaSaveBonusBets=gaSaveBonusBets;
function gaRenderAutoLockList(){
  const locks=getGlobal('autoLocks',{});
  const list=document.getElementById('gaAutoLockList');
  if(!list)return;
  const entries=Object.entries(locks);
  if(!entries.length){list.innerHTML='<div style="color:var(--text2);font-size:0.78rem">אין נעילות אוטומטיות</div>';return;}
  list.innerHTML=entries.map(([key,ts])=>{
    let name='';
    if(key.startsWith('series_')){const parts=key.split('_');const si=parseInt(parts[1]);const mk=parts[2];const t=getTeams(si,mk);name='🏀 '+(t.home&&t.away?`${t.home} מול ${t.away}`:mk);}
    else{const normKey=key==='0b'?'0b':parseInt(key);name=STAGE_NAMES[STAGE_KEYS.indexOf(normKey)]||key;}
    const d=new Date(ts);const now=Date.now();
    let locked=false;
    if(key.startsWith('series_')){const parts=key.split('_');locked=isSeriesLocked(parseInt(parts[1]),parts[2]);}
    else{const normKey=key==='0b'?'0b':parseInt(key);locked=(getGlobal('stageLocked',[]))[STAGE_KEYS.indexOf(normKey)]||false;}
    const status=locked?'<span style="color:var(--green);font-size:0.7rem">✅</span>':ts<now?'<span style="color:var(--red);font-size:0.7rem">⚡</span>':'<span style="color:var(--gold);font-size:0.7rem">⏳</span>';
    return`<div style="display:flex;align-items:center;justify-content:space-between;background:var(--dark);border-radius:8px;padding:7px 10px;margin-bottom:6px;font-size:0.8rem;">
      <span style="font-weight:700">${name}</span><span style="color:var(--text2)">${d.toLocaleString('he-IL')}</span>${status}
      <button onclick="removeAutoLock('${key}')" style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:0.8rem;padding:0 4px">✕</button>
    </div>`;
  }).join('');
}
window.gaRenderAutoLockList=gaRenderAutoLockList;
function updateAutoLockTargetsGA(){
  const type=document.getElementById('gaAutoLockType').value;
  const sel=document.getElementById('gaAutoLockTarget');
  if(type==='stage'){sel.innerHTML=`<option value="0">פליי-אין א</option><option value="0b">פליי-אין גמר</option><option value="1">סיבוב ראשון</option><option value="2">סיבוב שני</option><option value="3">גמר איזורי</option><option value="4">גמר NBA</option>`;}
  else{const opts=[];for(const si of [1,2,3,4]){for(const m of STAGE_MATCHES[si]||[]){const t=getTeams(si,m.key);const lbl=t.home&&t.away?`${t.home} מול ${t.away}`:m.label;opts.push(`<option value="series_${si}_${m.key}">${STAGE_SHORT[STAGE_KEYS.indexOf(si)]}: ${lbl}</option>`);}}sel.innerHTML=opts.join('');}
}
window.updateAutoLockTargetsGA=updateAutoLockTargetsGA;
async function gaAddAutoLock(){
  const lockType=document.getElementById('gaAutoLockType').value;
  const targetVal=document.getElementById('gaAutoLockTarget').value;
  const timeVal=document.getElementById('gaAutoLockTime').value;
  if(!timeVal){toast('⚠️ בחר תאריך ושעה');return;}
  const ts=new Date(timeVal).getTime();
  if(ts<=Date.now()){toast('⚠️ הזמן חייב להיות בעתיד');return;}
  const curLocks=getGlobal('autoLocks',{});
  await setDoc(doc(db,'global','settings'),{autoLocks:{...curLocks,[targetVal]:ts}},{merge:true});
  document.getElementById('gaAutoLockTime').value='';
  toast('✅ נעילה אוטומטית נקבעה!');gaRenderAutoLockList();
}
window.gaAddAutoLock=gaAddAutoLock;
async function fetchESPNScores(){
  const dp=document.getElementById('espnDatePicker');
  const list=document.getElementById('espnScoresList');
  if(!dp||!list)return;
  const dateVal=dp.value.replace(/-/g,''); // YYYYMMDD
  list.innerHTML='<div style="color:var(--text2);font-size:0.82rem">⏳ טוען...</div>';
  
  try{
    // Use CORS proxy to access ESPN API
    const url=`https://corsproxy.io/?${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateVal}&limit=20`)}`;
    const resp=await fetch(url);
    if(!resp.ok)throw new Error('Failed to fetch');
    const data=await resp.json();
    const events=data.events||[];
    
    if(!events.length){list.innerHTML='<div style="color:var(--text2);font-size:0.82rem">אין משחקים בתאריך זה</div>';return;}
    
    // Filter completed games
    const completed=events.filter(e=>{
      const status=e.status?.type?.completed;
      return status;
    });
    
    if(!completed.length){list.innerHTML='<div style="color:var(--text2);font-size:0.82rem">אין משחקים שהסתיימו בתאריך זה</div>';return;}
    
    list.innerHTML=completed.map(e=>{
      const comp=e.competitions?.[0];
      if(!comp)return '';
      const home=comp.competitors?.find(t=>t.homeAway==='home');
      const away=comp.competitors?.find(t=>t.homeAway==='away');
      if(!home||!away)return '';
      const homeName=home.team?.displayName||home.team?.name||'';
      const awayName=away.team?.displayName||away.team?.name||'';
      const homeScore=parseInt(home.score)||0;
      const awayScore=parseInt(away.score)||0;
      const winner=homeScore>awayScore?homeName:awayName;
      const loser=homeScore>awayScore?awayName:homeName;
      const winScore=Math.max(homeScore,awayScore);
      const loseScore=Math.min(homeScore,awayScore);
      
      // Check if playoff game
      const isPlayoff=e.season?.type===3||comp.notes?.[0]?.headline?.includes('Game')||comp.series;
      const seriesNote=comp.series?`סדרה: ${comp.series.summary||''}`:comp.notes?.[0]?.headline||'';
      
      return`<div style="background:var(--dark3);border-radius:10px;padding:12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:0.78rem;color:var(--text2)">${seriesNote}</span>
          <span style="font-size:0.7rem;color:var(--green)">✅ הסתיים</span>
        </div>
        <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px">
          🏆 <span style="color:var(--green)">${winner}</span> ניצחה
        </div>
        <div style="font-size:0.82rem;color:var(--text2);margin-bottom:8px">
          ${homeName} ${homeScore} — ${awayName} ${awayScore}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" style="font-size:0.75rem"
            onclick="applyESPNResult('${winner.replace(/'/g,"\'")}','${homeName.replace(/'/g,"\'")}','${awayName.replace(/'/g,"\'")}')">
            ✅ החל תוצאה זו
          </button>
        </div>
      </div>`;
    }).join('');
    
  }catch(e){
    list.innerHTML=`<div style="color:var(--red);font-size:0.82rem">❌ שגיאה: ${e.message}<br><span style="color:var(--text2)">ייתכן שיש בעיית CORS. נסה שוב.</span></div>`;
  }
}
window.fetchESPNScores=fetchESPNScores;

function applyESPNResult(winner,home,away){
  // Find which result select matches these team names and apply
  // Try to match by team name (partial match)
  const allSelects=document.querySelectorAll('[id^="ga_res_"]');
  let applied=false;
  allSelects.forEach(sel=>{
    if(sel.tagName!=='SELECT')return;
    // Check options
    for(const opt of sel.options){
      if(!opt.value)continue;
      const parts=opt.value.split('|');
      const teamInOpt=parts[0].toLowerCase();
      if(teamInOpt.includes(winner.toLowerCase().substring(0,5))||
         winner.toLowerCase().includes(teamInOpt.substring(0,5))){
        sel.value=opt.value;
        applied=true;
        break;
      }
    }
  });
  if(applied){toast('✅ תוצאה הוחלה! בדוק ושמור.');}
  else{
    // Fallback: show modal with winner name to manually match
    toast(`🏆 המנצחת: ${winner} — בחר ידנית את הסדרה המתאימה`);
  }
}
window.applyESPNResult=applyESPNResult;

function sendReminderEmailGA(){
  const link=`${location.origin}${location.pathname}`;
  const cs=getGlobal('currentStage',0);
  const stageName=STAGE_NAMES[STAGE_KEYS.indexOf(cs)]||'';
  const subject=encodeURIComponent(`תזכורת: הזן הימורים — ${stageName}`);
  const body=encodeURIComponent(`שלום,

תזכורת להזין את הימוריך עבור ${stageName}.

כניסה לאתר:
${link}

בהצלחה!`);
  window.open(`mailto:?subject=${subject}&body=${body}`);
}
window.sendReminderEmailGA=sendReminderEmailGA;

function showProfile(){
  showPage('page-profile');
  document.getElementById('profileName').value=currentUserDoc?.displayName||'';
  document.getElementById('profileUsername').value=currentUserDoc?.username||'';
  document.getElementById('profileNewPass').value='';
  document.getElementById('profileConfirmPass').value='';
}
window.showProfile=showProfile;

async function saveProfile(){
  const name=document.getElementById('profileName').value.trim();
  const username=document.getElementById('profileUsername').value.trim().replace(/\s+/g,'');
  if(!name||!username){toast('⚠️ מלא את כל השדות');return;}
  try{
    if(username!==currentUserDoc?.username){
      const uQ=await getDocs(query(collection(db,'users'),where('username','==',username)));
      if(!uQ.empty){toast('⚠️ שם המשתמש תפוס');return;}
    }
    await updateProfile(currentUser,{displayName:name});
    await updateDoc(doc(db,'users',currentUser.uid),{displayName:name,username:username});
    currentUserDoc={...currentUserDoc,displayName:name,username:username};
    document.getElementById('menuUsername').textContent='👤 '+username;
    // Update memberInfo in all leagues
    try{
      const leaguesSnap=await getDocs(query(collection(db,'leagues'),where('members','array-contains',currentUser.uid)));
      for(const ldoc of leaguesSnap.docs){
        await updateDoc(ldoc.ref,{[`memberInfo.${currentUser.uid}.username`]:username,[`memberInfo.${currentUser.uid}.displayName`]:name});
      }
    }catch(e2){console.warn('Could not update league memberInfo:',e2);}
    toast('✅ פרופיל עודכן!');
  }catch(e){console.error('saveProfile error:',e);toast('❌ '+e.message);}
}
window.saveProfile=saveProfile;

async function changePassword(){
  const oldPass=document.getElementById('profileOldPass').value;
  const newPass=document.getElementById('profileNewPass').value;
  const confirm=document.getElementById('profileConfirmPass').value;
  if(!oldPass||!newPass||!confirm){toast('⚠️ מלא את כל השדות');return;}
  if(newPass.length<6){toast('⚠️ סיסמה חייבת להיות לפחות 6 תווים');return;}
  if(newPass!==confirm){toast('⚠️ הסיסמאות אינן תואמות');return;}
  if(oldPass===newPass){toast('⚠️ הסיסמה החדשה חייבת להיות שונה מהישנה');return;}
  try{
    const {updatePassword,reauthenticateWithCredential,EmailAuthProvider}=await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js");
    const credential=EmailAuthProvider.credential(currentUser.email,oldPass);
    await reauthenticateWithCredential(currentUser,credential);
    await updatePassword(currentUser,newPass);
    document.getElementById('profileOldPass').value='';
    document.getElementById('profileNewPass').value='';
    document.getElementById('profileConfirmPass').value='';
    toast('✅ סיסמה שונתה בהצלחה!');
  }catch(e){
    if(e.code==='auth/wrong-password'||e.code==='auth/invalid-credential'){
      toast('❌ סיסמה ישנה שגויה');
    }else{
      toast('❌ '+e.message);
    }
  }
}
window.changePassword=changePassword;

async function doSignOut(){
  if(leagueUnsubscribe){leagueUnsubscribe();leagueUnsubscribe=null;}
  currentLeague=null;currentLeagueData=null;
  updateMenuForLeague(false);
  await fbSignOut(auth);
}

// ── NAV ──
function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(id).classList.add('active');}
function goHome(){
  if(leagueUnsubscribe){leagueUnsubscribe();leagueUnsubscribe=null;}
  currentLeague=null;currentLeagueData=null;
  updateMenuForLeague(false);
  document.getElementById('homeUsername').textContent=currentUserDoc?.username||'';
  // Show admin button if super admin
  if(isSuperAdmin()){
    const saBtn=document.getElementById('superAdminHomeBtn');
    if(saBtn)saBtn.style.display='';
  }
  showPage('page-home');
}
function updateMenuForLeague(inLeague,isAdmin=false){
  ['menuLeaderboard','menuEnterBets','menuViewBets'].forEach(id=>document.getElementById(id).style.display=inLeague?'':'none');
}

// ── LEAGUES ──
function generateCode(){return Math.floor(100000+Math.random()*900000).toString();}
async function createLeague(){
  const name=document.getElementById('newLeagueName').value.trim();
  if(!name){toast('⚠️ הכנס שם ליגה');return;}
  let code,tries=0;
  do{code=generateCode();const s=await getDocs(query(collection(db,'leagues'),where('code','==',code)));if(s.empty)break;tries++;}while(tries<10);
  const lid=`league_${Date.now()}_${currentUser.uid.slice(0,6)}`;
  const ld={id:lid,name,code,adminUid:currentUser.uid,members:[currentUser.uid],
    memberInfo:{[currentUser.uid]:{username:currentUserDoc.username,displayName:currentUserDoc.displayName}},
    currentStage:0,stageLocked:[false,false,false,false,false,false],
    teams:{stage0:{},stage0b:{},stage1:{},stage2:{},stage3:{},stage4:{}},
    results:{stage0:null,stage0b:null,stage1:null,stage2:null,stage3:null,stage4:null},
    bonusBets:{stage0:[]},
    bonusResults:{stage0:{}},
    bets:{},createdAt:serverTimestamp()};
  await setDoc(doc(db,'leagues',lid),ld);
  await updateDoc(doc(db,'users',currentUser.uid),{leagues:arrayUnion(lid)});
  const link=`${location.origin}${location.pathname}?code=${code}`;
  document.getElementById('createdLeagueCode').textContent=code;
  document.getElementById('createdLeagueLink').value=link;
  document.getElementById('leagueCreatedInfo').style.display='';
  currentLeague=lid;toast('✅ ליגה נוצרה!');
}
function enterCreatedLeague(){if(currentLeague)openLeague(currentLeague);}
async function joinLeague(){
  const code=document.getElementById('joinCode').value.trim();
  if(code.length!==6){toast('⚠️ קוד בן 6 ספרות');return;}
  await autoJoinLeague(code);
}
async function autoJoinLeague(code){
  try{
    const snap=await getDocs(query(collection(db,'leagues'),where('code','==',code)));
    if(snap.empty){toast('❌ קוד לא נמצא');return;}
    const leagueDoc=snap.docs[0],ld=leagueDoc.data(),lid=leagueDoc.id;
    if(!ld.members.includes(currentUser.uid)){
      await updateDoc(doc(db,'leagues',lid),{members:arrayUnion(currentUser.uid),[`memberInfo.${currentUser.uid}`]:{username:currentUserDoc.username,displayName:currentUserDoc.displayName}});
      await updateDoc(doc(db,'users',currentUser.uid),{leagues:arrayUnion(lid)});
      toast('✅ הצטרפת לליגה!');
    }
    history.replaceState({},'',location.pathname);
    openLeague(lid);
  }catch(e){toast('❌ שגיאה: '+e.message);}
}
async function loadMyLeagues(){
  showPage('page-my-leagues');
  const list=document.getElementById('myLeaguesList');
  list.innerHTML='<div class="loader"><div class="spinner"></div><span>טוען...</span></div>';
  try{
    const uSnap=await getDoc(doc(db,'users',currentUser.uid));
    const ids=uSnap.data()?.leagues||[];
    if(!ids.length){list.innerHTML='<div class="empty-state"><div class="icon">🏀</div><p>אין ליגות עדיין</p></div>';return;}
    const docs=await Promise.all(ids.map(id=>getDoc(doc(db,'leagues',id))));
    list.innerHTML=docs.filter(d=>d.exists()).map(d=>{
      const ld=d.data(),isAdmin=ld.adminUid===currentUser.uid;
      return`<div class="league-row" onclick="openLeague('${d.id}')">
        <div><div class="lr-name">${ld.name} ${isAdmin?'👑':''}</div>
        <div class="lr-meta">${ld.members.length} משתתפים | קוד: ${ld.code} | ${STAGE_NAMES[STAGE_KEYS.indexOf(getGlobal('currentStage',0))]||''}</div></div>
        <span style="color:var(--orange);font-size:1.1rem">←</span></div>`;
    }).join('');
  }catch(e){list.innerHTML='<div class="empty-state"><p>שגיאה בטעינה</p></div>';}
}
let globalUnsubscribe=null;
let globalData={};
function getGlobal(field,fallback){return globalData[field]!==undefined?globalData[field]:fallback;}

async function openLeague(lid){
  showPage('page-league');
  document.getElementById('leaderboardList').innerHTML='<div class="loader"><div class="spinner"></div></div>';
  if(leagueUnsubscribe)leagueUnsubscribe();
  
  // Ensure globalData is loaded before rendering
  if(Object.keys(globalData).length===0){
    // Wait for globalData to load
    await new Promise(resolve=>{
      const check=setInterval(()=>{
        if(Object.keys(globalData).length>0){clearInterval(check);resolve();}
      },100);
      setTimeout(()=>{clearInterval(check);resolve();},3000); // max 3s wait
    });
  }

  leagueUnsubscribe=onSnapshot(doc(db,'leagues',lid),snap=>{
    if(!snap.exists()){toast('❌ ליגה לא נמצאה');goHome();return;}
    currentLeague=lid;currentLeagueData=snap.data();
    renderLeaguePage();
  });
}
function renderLeaguePage(){
  const ld=currentLeagueData;
  document.getElementById('leaguePageTitle').textContent=ld.name;
  document.getElementById('leaguePageCode').textContent=ld.code;
  updateMenuForLeague(true,false);
  showLeagueTab('leaderboard');
}

// ── LEAGUE TABS ──
function showLeagueTab(tab){
  ['leaderboard','bets','enter-bets','prebets'].forEach(t=>{const el=document.getElementById('ltab-'+t);if(el)el.style.display=t===tab?'':'none';});
  document.querySelectorAll('#leagueNavTabs .nav-tab').forEach((b,i)=>b.classList.toggle('active',['leaderboard','bets','enter-bets','prebets'][i]===tab));
  if(tab==='leaderboard')renderLeaderboard();
  if(tab==='bets'){renderViewStageTabs();const ci=currentLeagueData.currentStage;viewStage(ci>0?STAGE_KEYS[Math.max(0,STAGE_KEYS.indexOf(ci)-1)]:0);}
  if(tab==='enter-bets')renderBetForm();
  if(tab==='prebets')renderPrebetsTab();
  if(tab==='admin'){initGlobalSettingsIfNeeded().then(()=>{
    renderAdmin();
    renderTeamSetupForm();
    renderBonusAdmin();
    renderResultForm();
  });}
}

// ── SCORING ──
function getSeriesWinner(si,mk){
  const r=(getGlobal('results',{}))['stage'+si]||{};
  return r[mk+'_winner']||'';
}

// Auto-compute teams for a stage based on previous stage results
function getAutoTeams(si,mk){
  if(si===1){
    // Stage 1: winners from playin (stage0b) - already set manually
    return null;
  }
  if(si===2){
    // Stage 2: winners from stage1 series match up
    // e1(1v4east): winner of e1 vs winner of e4
    // e2(2v3east): winner of e2 vs winner of e3
    // w1(1v4west): winner of w1 vs winner of w4
    // w2(2v3west): winner of w2 vs winner of w3
    const map={e1:{home:'e1',away:'e4'},e2:{home:'e2',away:'e3'},w1:{home:'w1',away:'w4'},w2:{home:'w2',away:'w3'}};
    if(map[mk]){
      const home=getSeriesWinner(1,map[mk].home);
      const away=getSeriesWinner(1,map[mk].away);
      if(home||away)return{home,away};
    }
    return null;
  }
  if(si===3){
    // Stage 3: winners from stage2
    // east: winner of e1 vs winner of e2
    // west: winner of w1 vs winner of w2
    const map={east:{home:'e1',away:'e2'},west:{home:'w1',away:'w2'}};
    if(map[mk]){
      const home=getSeriesWinner(2,map[mk].home);
      const away=getSeriesWinner(2,map[mk].away);
      if(home||away)return{home,away};
    }
    return null;
  }
  if(si===4){
    // Stage 4: east winner vs west winner
    if(mk==='finals'){
      const home=getSeriesWinner(3,'east');
      const away=getSeriesWinner(3,'west');
      if(home||away)return{home,away};
    }
    return null;
  }
  return null;
}

function getTeams(si,mk){
  // First try auto-computed teams from previous stage results
  const auto=getAutoTeams(si,mk);
  if(auto&&(auto.home||auto.away))return auto;
  // Then try globalData (manually set)
  const gt=getGlobal('teams',{});
  const fromGlobal=(gt['stage'+si]||{})[mk];
  if(fromGlobal&&(fromGlobal.home||fromGlobal.away))return fromGlobal;
  // Fallback to leagueData
  return((currentLeagueData?.teams||{})['stage'+si]||{})[mk]||{home:'',away:''};
}
function teamLabel(si,mk,fb){const t=getTeams(si,mk);return(t.home&&t.away)?`${t.home} מול ${t.away}`:fb;}
function getBonusBets(si){return(getGlobal('bonusBets',{}))[getBonusStageKey(si)]||[];}
function getBonusResults(si){return(getGlobal('bonusResults',{}))[getBonusStageKey(si)]||{};}

function scoreStage(uid,si){
  const siKey=String(si);
  const bet=(currentLeagueData?.bets||{})[uid]?.['stage'+siKey]||{};
  const result=(getGlobal('results',{}))['stage'+siKey];
  let pts=0;
  if(result){
    const matches=STAGE_MATCHES[si];
    if(si===0){
      // stage0: 4 games only, no bonuses here
      for(const m of matches){const b=(bet[m.key]||'').toLowerCase().trim(),r=(result[m.key]||'').toLowerCase().trim();if(b&&r&&b===r)pts++;}
    } else if(si==='0b'){
      // stage0b: 2 finals + calculate ALL 6 playin bonuses
      for(const m of matches){const b=(bet[m.key]||'').toLowerCase().trim(),r=(result[m.key]||'').toLowerCase().trim();if(b&&r&&b===r)pts++;}
      // Full playin bonus check (all 6 games)
      const bet0=(currentLeagueData?.bets||{})[uid]?.['stage0']||{};
      const result0=(getGlobal('results',{}))['stage0']||{};
      const allMatches=[...STAGE_MATCHES[0],...STAGE_MATCHES['0b']];
      let eCAll=0,wCAll=0,totAll=0;
      for(const m of allMatches){
        const bSrc=STAGE_MATCHES[0].find(x=>x.key===m.key)?bet0:bet;
        const rSrc=STAGE_MATCHES[0].find(x=>x.key===m.key)?result0:result;
        const b=(bSrc[m.key]||'').toLowerCase().trim(),r=(rSrc[m.key]||'').toLowerCase().trim();
        if(b&&r&&b===r){totAll++;if(m.conf==='east')eCAll++;else wCAll++;}
      }
      if(eCAll===3)pts+=1;if(wCAll===3)pts+=1;if(totAll===6)pts+=1;
      // bonus bets scored below
    } else if(si===1){
      const eK=['e1','e2','e3','e4'];let eW=0,wW=0,aW=0,eX=0,wX=0,aX=0;
      for(const m of matches){
        const bW=(bet[m.key+'_winner']||'').toLowerCase().trim(),rW=(result[m.key+'_winner']||'').toLowerCase().trim();
        const bR=bet[m.key+'_result']||'',rR=result[m.key+'_result']||'';
        if(bW&&rW&&bW===rW){if(bR&&rR&&bR===rR){pts+=4;aX++;if(eK.includes(m.key))eX++;else wX++;}else{pts+=2;}aW++;if(eK.includes(m.key))eW++;else wW++;}
      }
      // Bonus: all 8 winners = +7, else east 4 = +3, west 4 = +3
      // Exact result bonuses: all 8 exact = +14, else east 4 exact = +6, west 4 exact = +6
      if(aW===8){pts+=(aX===8?14:7);}
      else{if(eW===4)pts+=(eX===4?6:3);if(wW===4)pts+=(wX===4?6:3);}
      const bc=(bet.champion||'').toLowerCase(),rc=(result.champion||'').toLowerCase();if(bc&&rc&&bc===rc)pts+=10;
      const be=(bet.east_champ||'').toLowerCase(),re=(result.east_champ||'').toLowerCase();if(be&&re&&be===re)pts+=3;
      const bw=(bet.west_champ||'').toLowerCase(),rw=(result.west_champ||'').toLowerCase();if(bw&&rw&&bw===rw)pts+=3;
      const bF=[bet.east_champ,bet.west_champ].filter(Boolean).map(x=>x.toLowerCase()).sort().join('|');
      const rF=[result.east_champ,result.west_champ].filter(Boolean).map(x=>x.toLowerCase()).sort().join('|');
      if(bF&&rF&&bF===rF)pts+=3;
    } else if(si===2){
      const eK=['e1','e2'];let eW=0,wW=0,aW=0,eX=0,wX=0,aX=0;
      for(const m of matches){
        const bW=(bet[m.key+'_winner']||'').toLowerCase().trim(),rW=(result[m.key+'_winner']||'').toLowerCase().trim();
        const bR=bet[m.key+'_result']||'',rR=result[m.key+'_result']||'';
        if(bW&&rW&&bW===rW){if(bR&&rR&&bR===rR){pts+=6;aX++;if(eK.includes(m.key))eX++;else wX++;}else{pts+=3;}aW++;if(eK.includes(m.key))eW++;else wW++;}
      }
      // Bonus: all 4 winners = +7, else east 2 = +3, west 2 = +3
      if(aW===4){pts+=(aX===4?14:7);}
      else{pts+=(eX===2?6:eW===2?3:0)+(wX===2?6:wW===2?3:0);}
    } else if(si===3){
      let bW2=true,bX2=true;
      for(const m of matches){
        const bW=(bet[m.key+'_winner']||'').toLowerCase().trim(),rW=(result[m.key+'_winner']||'').toLowerCase().trim();
        const bR=bet[m.key+'_result']||'',rR=result[m.key+'_result']||'';
        const w=bW&&rW&&bW===rW,x=bR&&rR&&bR===rR;
        if(w){if(x)pts+=8;else pts+=4;}else bW2=false;if(!x)bX2=false;
        const bM=(bet[m.key+'_mvp']||'').toLowerCase(),rM=(result[m.key+'_mvp']||'').toLowerCase();if(bM&&rM&&bM===rM)pts+=1;
      }
      if(bW2)pts+=(bX2?6:3);
    } else if(si===4){
      const m=matches[0];
      const bW=(bet[m.key+'_winner']||'').toLowerCase(),rW=(result[m.key+'_winner']||'').toLowerCase();
      const s4exact=(bet[m.key+'_result']||'')===(result[m.key+'_result']||'');
      if(bW&&rW&&bW===rW){if(s4exact)pts+=10;else pts+=5;}
      const bM=(bet[m.key+'_mvp']||'').toLowerCase(),rM=(result[m.key+'_mvp']||'').toLowerCase();if(bM&&rM&&bM===rM)pts+=2;
    }
  }
  // Bonus bets scoring - only score on stage '0b' (end of playin) using shared bonus key
  if(si==='0b'){
    const bonuses=getBonusBets(0),bonusResults=getBonusResults(0);
    // use stage0 bets for bonus answers (bonus was entered in stage0)
    const bet0=(currentLeagueData?.bets||{})[uid]?.['stage0']||{};
    for(const b of bonuses){
      const userAns=(bet0['bonus_'+b.id]||bet['bonus_'+b.id]||'').toLowerCase().trim();
      const correctAns=(bonusResults[b.id]||'').toLowerCase().trim();
      if(userAns&&correctAns&&userAns===correctAns)pts+=b.points;
    }
  }
  return pts;
}

// ── LEADERBOARD ──
function renderLeaderboard(){
  const ld=currentLeagueData,members=ld.members||[],memberInfo=ld.memberInfo||{};
  const scores=members.map(uid=>{
    let total=0,bd={};
    for(const sk of STAGE_KEYS){const p=scoreStage(uid,sk);bd['s'+String(sk)]=p;total+=p;}
    return{uid,total,bd,info:memberInfo[uid]||{username:uid,displayName:''}};
  }).sort((a,b)=>b.total-a.total);
  const el=document.getElementById('leaderboardList');
  if(!scores.length){el.innerHTML='<div class="empty-state"><div class="icon">🏀</div><p>אין משתתפים</p></div>';return;}
  el.innerHTML=scores.map(({uid,total,bd,info},i)=>{
    const rank=i+1,medal=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':rank;
    const breakdown=STAGE_SHORT.map((s,i)=>{const k=String(STAGE_KEYS[i]);return bd['s'+k]>0?`${s}: ${bd['s'+k]}`:null;}).filter(Boolean).join(' | ');
    return`<div class="lb-row rank-${rank}"><div class="lb-rank">${medal}</div>
      <div class="lb-info"><div class="lb-username">${info.username||uid}</div><div class="lb-displayname">${info.displayName||''}</div>${breakdown?`<div class="lb-breakdown">${breakdown}</div>`:''}</div>
      <div class="lb-score">${total} נק'</div></div>`;
  }).join('');
  const csIdx=STAGE_KEYS.indexOf(getGlobal('currentStage',0));
  const locked=(getGlobal('stageLocked',[]))[csIdx]||false;
  document.getElementById('lb-stage-badge').textContent=STAGE_NAMES[csIdx]||'';
  const cs=getGlobal('currentStage',0);
  document.getElementById('lb-stage-badge').className='badge '+(locked?'badge-locked':'badge-open');
}

// ── BETS VIEW ──
function renderViewStageTabs(){
  document.getElementById('viewStageTabs').innerHTML=STAGE_SHORT.map((s,i)=>{
    const k=STAGE_KEYS[i];
    const kStr=typeof k==='string'?`'${k}'`:k;
    return `<button class="stage-tab ${i===0?'active':''}" onclick="viewStage(${kStr})">${s}</button>`;
  }).join('');
}
function viewStage(idx){
  const idxStr=String(idx);
  document.querySelectorAll('.stage-tab').forEach((t,i)=>t.classList.toggle('active',String(STAGE_KEYS[i])===idxStr));
  // Normalize idx - could be number or string '0b'
  const idxNorm=(idx==='0b'||idx===0||idx==='0')?idx:(typeof idx==='string'?parseInt(idx):idx);
  const idxNum=STAGE_KEYS.indexOf(idxNorm);
  const stageLocks=getGlobal('stageLocked',[false,false,false,false,false,false]);
  const locked=stageLocks[idxNum]||false;
  const currentStageIdx=STAGE_KEYS.indexOf(getGlobal('currentStage',0));
  const content=document.getElementById('betsContent');
  // For playin stages (0 and 0b), require stage lock to view
  // For series stages (1-4), show per-series even without stage lock
  const isSeriesStage=idx!==0&&idx!=='0b';
  if(!locked&&!isSeriesStage){
    content.innerHTML='<div class="card"><div class="empty-state"><div class="icon">🔒</div><p>ניתן לצפות לאחר נעילת השלב</p></div></div>';
    return;
  }
  // For series stages with no stage lock - check if ANY series is locked
  if(isSeriesStage&&!locked){
    const anySeriesLocked=STAGE_MATCHES[idx]?.some(m=>isSeriesLocked(idx,m.key));
    if(!anySeriesLocked){
      content.innerHTML='<div class="card"><div class="empty-state"><div class="icon">🔒</div><p>ניתן לצפות לאחר נעילת סדרה</p></div></div>';
      return;
    }
  }
  const ld=currentLeagueData;
  const result=(getGlobal('results',{}))['stage'+idx]||{},matches=STAGE_MATCHES[idx];
  const members=ld.members||[],memberInfo=ld.memberInfo||{};
  const bonuses=getBonusBets(idx),bonusResults=getBonusResults(idx);
  const cards=members.map(uid=>{
    const info=memberInfo[uid]||{username:uid};
    const bet=((ld.bets||{})[uid]||{})['stage'+idx]||{};
    const stageScore=scoreStage(uid,idx);
    let items='';
    if(idx===0||idx==='0b'){
      for(const m of matches){const bv=bet[m.key]||'-';let cls='pending';if(result[m.key])cls=bv.toLowerCase()===result[m.key].toLowerCase()?'correct':'wrong';items+=`<div class="bet-item"><span class="bet-label">${teamLabel(idx,m.key,m.label)}</span><span class="bet-value ${cls}">${bv}</span></div>`;}
    } else {
      for(const m of matches){
        const serLocked=isSeriesLocked(idx,m.key);
        if(!serLocked){
          // Series not locked - show grey placeholder
          items+=`<div class="bet-item"><span class="bet-label">${teamLabel(idx,m.key,m.label)}</span><span class="bet-value" style="color:var(--border)">- טרם ננעל -</span></div>`;
          continue;
        }
        const bW=bet[m.key+'_winner']||'-',bR=bet[m.key+'_result']||'-';
        let wC='pending';
        const winMatch=result[m.key+'_winner']&&bW.toLowerCase()===result[m.key+'_winner'].toLowerCase();
        const resMatch=result[m.key+'_result']&&bR===result[m.key+'_result'];
        if(result[m.key+'_winner']){
          if(winMatch&&resMatch)wC='correct-exact';
          else if(winMatch)wC='correct';
          else wC='wrong';
        }
        items+=`<div class="bet-item"><span class="bet-label">${teamLabel(idx,m.key,m.label)}</span><span class="bet-value ${wC}">${bW} <span style="opacity:0.65">(${bR})</span></span></div>`;
        if(m.hasMvp){const bM=bet[m.key+'_mvp']||'-';let mC='pending';if(result[m.key+'_mvp'])mC=bM.toLowerCase()===result[m.key+'_mvp'].toLowerCase()?'correct':'wrong';items+=`<div class="bet-item"><span class="bet-label">MVP</span><span class="bet-value ${mC}">${bM}</span></div>`;}
      }
      if(idx===1&&isPreBetsLocked()){for(const p of PREBETS){const bv=bet[p.key]||'-';let cls='pending';if(result[p.key])cls=bv.toLowerCase()===(result[p.key]||'').toLowerCase()?'correct':'wrong';items+=`<div class="bet-item"><span class="bet-label">${p.label}</span><span class="bet-value ${cls}">${bv}</span></div>`;}}
    }
    // Bonus bets in view - only show locked bonuses
    for(const b of bonuses){
      if(!isSingleBonusLocked(idx,b))continue; // skip unlocked bonuses
      const bv=bet['bonus_'+b.id]||'-';let cls='pending';
      const correctAns=bonusResults[b.id]||'';
      if(correctAns)cls=bv.toLowerCase()===correctAns.toLowerCase()?'correct':'wrong';
      items+=`<div class="bet-item"><span class="bet-label" style="color:var(--gold)">⭐ ${b.question}</span><span class="bet-value ${cls}">${bv}</span></div>`;
    }
    return`<div class="bet-card"><div class="bet-header"><div><div class="bet-player-username">${info.username||uid}</div><div class="bet-player-name">${info.displayName||''}</div></div><div class="bet-pts">${(stageScore>0||result)?stageScore+' נק\'':'⏳'}</div></div>${items}</div>`;
  }).join('');
  // Build results display
  let resultsHtml='';
  if(Object.keys(result).length>0){
    resultsHtml+='<div class="card" style="margin-top:14px;border-color:rgba(79,195,247,0.3)"><div class="card-title" style="color:var(--blue)">📊 תוצאות אמיתיות</div>';
    if(idx===0||idx==='0b'){
      for(const m of matches){
        const rv=result[m.key]||'-';
        const lbl=teamLabel(idx,m.key,m.label);
        resultsHtml+=`<div class="bet-item"><span class="bet-label">${lbl}</span><span class="bet-value" style="color:var(--blue)">${rv}</span></div>`;
      }
    } else {
      for(const m of matches){
        const rW=result[m.key+'_winner']||'-';
        const rR=result[m.key+'_result']||'-';
        const lbl=teamLabel(idx,m.key,m.label);
        resultsHtml+=`<div class="bet-item"><span class="bet-label">${lbl}</span><span class="bet-value" style="color:var(--blue)">${rW} (${rR})</span></div>`;
        if(m.hasMvp&&result[m.key+'_mvp'])resultsHtml+=`<div class="bet-item"><span class="bet-label">MVP</span><span class="bet-value" style="color:var(--blue)">${result[m.key+'_mvp']}</span></div>`;
      }
    }
    resultsHtml+='</div>';
  }
  content.innerHTML=`<div class="bets-grid">${cards}</div>${resultsHtml}`;
}

// ── BET FORM ──
function renderBetForm(){
  const siRaw=document.getElementById('betStageSelect').value;
  const si=siRaw==='0b'?'0b':parseInt(siRaw);
  const siIdx=STAGE_KEYS.indexOf(si);
  const locked=(getGlobal('stageLocked',[]))[siIdx]||false;
  const content=document.getElementById('betFormContent');
  CBD={};
  if(locked){
    // Show read-only view of own bets
    const myBet=(currentLeagueData?.bets||{})[currentUser.uid]?.['stage'+si]||{};
    if(Object.keys(myBet).length===0){
      content.innerHTML='<div class="info-box" style="color:var(--red);border-color:rgba(255,68,68,0.3)">🔒 שלב זה נעול ולא הזנת הימורים</div>';
    } else {
      const matches2=STAGE_MATCHES[si]||[];
      let roHtml='<div class="info-box" style="color:var(--red);border-color:rgba(255,68,68,0.3);margin-bottom:12px">🔒 שלב זה נעול — ההימורים שלך:</div>';
      if(si===0||si==='0b'){
        for(const m of matches2){const v=myBet[m.key]||'-';roHtml+=`<div class="bet-item"><span class="bet-label">${teamLabel(si,m.key,m.label)}</span><span class="bet-value pending">${v}</span></div>`;}
      } else {
        for(const m of matches2){const bW=myBet[m.key+'_winner']||'-',bR=myBet[m.key+'_result']||'-';roHtml+=`<div class="bet-item"><span class="bet-label">${teamLabel(si,m.key,m.label)}</span><span class="bet-value pending">${bW} (${bR})</span></div>`;}
        if(si===1){for(const p of PREBETS){roHtml+=`<div class="bet-item"><span class="bet-label">${p.label}</span><span class="bet-value pending">${myBet[p.key]||'-'}</span></div>`;}}
      }
      content.innerHTML=roHtml;
    }
    return;
  }
  if(!canBetOnStage(si)){
    const prevNames={'0b':'פליי-אין סיבוב א',1:'פליי-אין גמר',2:'סיבוב ראשון',3:'סיבוב שני',4:'גמר איזורי'};
    const prevName=prevNames[si]||'השלב הקודם';
    content.innerHTML=`<div class="info-box" style="color:var(--text2)">⏳ ניתן להמר רק לאחר הזנת תוצאות ${prevName}</div>`;
    return;
  }
  const matches=STAGE_MATCHES[si];
  let html='<div class="separator"></div>';
  if(si===0||si==='0b'){
    html+='<div class="card-title" style="margin-bottom:10px">🎯 בחר מנצחת</div>';
    for(const m of matches){
      let t1,t2,lbl,subLabel='';
      if(si==='0b'){
        const ft=getPlayinFinalTeams(m.conf);
        t1=ft.home; t2=ft.away;
        lbl=m.label;
        subLabel=m.conf==='east'?'מזרח: מקום 7 מול 8 (מפסיד) נגד מקום 9 מול 10 (מנצח)':'מערב: מקום 7 מול 8 (מפסיד) נגד מקום 9 מול 10 (מנצח)';
      } else {
        const t=getTeams(si,m.key);
        t1=t.home||'קבוצה 1'; t2=t.away||'קבוצה 2';
        lbl=t.home&&t.away?`${t1} מול ${t2}`:m.label;
        // Add position label for stage 0
        const posMap={e78:'מזרח: מקום 7 מול מקום 8',e910:'מזרח: מקום 9 מול מקום 10',w78:'מערב: מקום 7 מול מקום 8',w910:'מערב: מקום 9 מול מקום 10'};
        subLabel=posMap[m.key]||'';
      }
      html+=`<div class="playin-card">${subLabel?`<div style="font-size:0.72rem;color:var(--text2);text-align:center;margin-bottom:4px">${subLabel}</div>`:''}<div class="match-label">🏀 ${lbl}</div>
        <div class="team-btns">
          <button class="team-btn" id="pb_${m.key}_0" data-mk="${m.key}" data-si="${si}" onclick="pickPlayin(this.dataset.mk,this.textContent.trim(),this.dataset.si)">${t1||'?'}</button>
          <button class="team-btn" id="pb_${m.key}_1" data-mk="${m.key}" data-si="${si}" onclick="pickPlayin(this.dataset.mk,this.textContent.trim(),this.dataset.si)">${t2||'?'}</button>
        </div></div>`;
    }
  } else {
    html+=`<div class="card-title" style="margin-bottom:10px">🎯 בחר תוצאה</div>`;
    for(const m of matches){
      const t=getTeams(si,m.key),home=t.home||'ביתית',away=t.away||'אורחת';
      const lbl=t.home&&t.away?`${home} מול ${away}`:m.label;
      const hOpts=GAPS.map(r=>`<button class="bet-opt home-opt" id="bo_${m.key}_h_${r.replace('-','')}" data-mk="${m.key}" data-team="${home}" data-res="${r}" data-si="${si}" onclick="pickSeries(this.dataset.mk,this.dataset.team,this.dataset.res,this.dataset.si)" style="width:100%"><span class="opt-res">${r}</span></button>`).join('');
      const aOpts=GAPS.map(r=>`<button class="bet-opt away-opt" id="bo_${m.key}_a_${r.replace('-','')}" data-mk="${m.key}" data-team="${away}" data-res="${r}" data-si="${si}" onclick="pickSeries(this.dataset.mk,this.dataset.team,this.dataset.res,this.dataset.si)" style="width:100%"><span class="opt-res">${r}</span></button>`).join('');
      const mSerLocked=isSeriesLocked(si,m.key);
      if(mSerLocked){
        html+=`<div class="matchup-bet-card" style="opacity:0.5;pointer-events:none"><div class="match-label">🏀 ${lbl} 🔒</div><div style="color:var(--text2);font-size:0.8rem;text-align:center;padding:8px">סדרה זו ננעלה</div>`;
      } else {
      html+=`<div class="matchup-bet-card"><div class="match-label">🏀 ${lbl}</div>
        <div style="display:flex;gap:10px;margin-top:7px;align-items:stretch;">
          <div style="flex:1;display:flex;flex-direction:column;gap:5px;padding:6px 8px;background:rgba(79,195,247,0.05);border-radius:8px;border:1px solid rgba(79,195,247,0.15);">
            <div style="font-size:0.7rem;color:var(--blue);font-weight:700;text-align:center;margin-bottom:2px">${home} 🏠</div>
            ${hOpts}
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:5px;padding:6px 8px;background:rgba(255,107,0,0.05);border-radius:8px;border:1px solid rgba(255,107,0,0.15);">
            <div style="font-size:0.7rem;color:var(--orange);font-weight:700;text-align:center;margin-bottom:2px">${away} ✈️</div>
            ${aOpts}
          </div>
        </div>
        ${m.hasMvp?`<div class="form-group" style="margin-top:9px;margin-bottom:0"><label>🏅 MVP</label><input type="text" id="mvp_${m.key}" placeholder="שם שחקן..." oninput="CBD['${m.key}_mvp']=this.value"></div>`:''}
      </div>`;
      } // end else mSerLocked
    }
    if(si===1){
      html+=`<div class="separator"></div><div class="card-title" style="margin-bottom:10px">🏆 הימורים מראש</div>`;
      // Build team lists from stage1
      const s1teams=STAGE_MATCHES[1];
      const eastTeams=[],westTeams=[];
      for(const m of s1teams){
        const t=getTeams(1,m.key);
        if(m.conf==='east'){if(t.home)eastTeams.push(t.home);if(t.away)eastTeams.push(t.away);}
        else{if(t.home)westTeams.push(t.home);if(t.away)westTeams.push(t.away);}
      }
      const allTeams=[...eastTeams,...westTeams];
      
      const makeOpts=(teams,curVal)=>[...teams].sort((a,b)=>a.localeCompare(b,'he')).map(t=>`<option value="${t}" ${curVal===t?'selected':''}>${t}</option>`).join('');
      
      if(isPreBetsLocked()){
        html+=`<div class="info-box" style="color:var(--red);border-color:rgba(255,68,68,0.3)">🔒 הימורים מוקדמים ננעלו</div>`;
      } else if(!Object.keys(getGlobal('seriesLocked',{})).some(k=>k.startsWith('1_'))){
        // No stage 1 series has ever been locked - hide pre-bets until first lock
        html+=`<div class="info-box" style="color:var(--text2)">⏳ הימורים מוקדמים יפתחו לאחר נעילת הסדרה הראשונה</div>`;
      } else {
      html+=`<div class="form-group"><label>🏆 אלוף NBA</label>
        <select id="pre_champion" onchange="CBD['champion']=this.value">
          <option value="">בחר קבוצה...</option>${makeOpts(allTeams,CBD['champion']||'')}
        </select></div>`;
      html+=`<div class="form-group"><label>🔵 אלופת המזרח</label>
        <select id="pre_east_champ" onchange="CBD['east_champ']=this.value">
          <option value="">בחר קבוצה...</option>${makeOpts(eastTeams,CBD['east_champ']||'')}
        </select></div>`;
      html+=`<div class="form-group"><label>🔴 אלופת המערב</label>
        <select id="pre_west_champ" onchange="CBD['west_champ']=this.value">
          <option value="">בחר קבוצה...</option>${makeOpts(westTeams,CBD['west_champ']||'')}
        </select></div>`;
      } // end else isPreBetsLocked
    }
  }
  // Bonus bets in form — show one at a time, only if stage0 not locked
  const bonuses=getBonusBets(si);
  const bonusLocked=isBonusLocked(si);
  if(bonuses.length>0){
    html+=`<div class="separator"></div><div class="card-title" style="margin-bottom:10px">⭐ הימורי בונוס</div>`;
    if(bonusLocked){html+=`<div class="info-box" style="color:var(--red);border-color:rgba(255,68,68,0.3)">🔒 הימורי הבונוס ננעלו עם שלב א' של הפליי-אין</div>`;}
    else{
    // Show first bonus, rest hidden; user reveals with button
    // Only show bonuses that are NOT yet locked (user can still bet)
    // Bonuses with seriesKey: show only if that series is NOT locked yet
    // Bonuses without seriesKey: show only if stage is NOT locked
    const availableBonuses=bonuses.filter(b=>{
      if(isSingleBonusLocked(si,b))return false; // locked - can't bet
      if(b.seriesKey&&!isSeriesLocked(si,b.seriesKey))return false; // series not locked yet - hide
      return true;
    });
    for(let bi=0;bi<availableBonuses.length;bi++){
      const b=availableBonuses[bi];
      const opts=b.answers.map(a=>`<button class="bonus-opt" id="bopt_${b.id}_${encodeURIComponent(a)}" onclick="pickBonus('${b.id}',this.getAttribute('data-val'))" data-val="${a}">${a}</button>`).join('');
      html+=`<div class="bonus-bet-card" id="bbc_${bi}" style="${bi>0?'display:none':''}">
        <div class="bonus-label"><span>⭐ הימור בונוס ${bi+1}/${availableBonuses.length}</span><span class="bonus-pts-badge">${b.points} נק'</span></div>
        <div class="bonus-q">${b.question}</div>
        <div class="bonus-opts">${opts}</div>
        ${bi<availableBonuses.length-1?`<div style="margin-top:10px"><button class="btn btn-secondary btn-sm" onclick="showNextBonus(${bi})">הימור בונוס הבא ←</button></div>`:''}
      </div>`;
    }
    if(availableBonuses.length===0&&bonuses.length>0){
      html+=`<div class="info-box" style="color:var(--text2)">כל הימורי הבונוס לשלב זה ננעלו</div>`;
    }
  } // end else bonusLocked
  } // end if bonuses.length
  html+=`<div style="margin-top:16px;display:flex;gap:9px;flex-wrap:wrap;">
    <button class="btn btn-primary" style="width:auto" onclick="saveBet(this.dataset.si)" data-si="${si}">💾 שמור הימורים</button>
    <button class="btn btn-secondary btn-sm" onclick="autoFillBets(this.dataset.si)" data-si="${si}" style="background:rgba(255,215,0,0.1);border-color:rgba(255,215,0,0.3);color:var(--gold)">🎲 מילוי אוטומטי</button>
    <button class="btn btn-secondary btn-sm" onclick="clearBets(this.dataset.si)" data-si="${si}">🔄 נקה ושמור</button>
  </div>`;
  content.innerHTML=html;
  // Load existing
  const existing=((currentLeagueData?.bets||{})[currentUser.uid]||{})['stage'+si]||{};
  if(Object.keys(existing).length){
    CBD={...existing};
    if(si===0||si==='0b'){for(const m of matches){if(existing[m.key])pickPlayin(m.key,existing[m.key],si);}}
    else{
      for(const m of matches){
        if(existing[m.key+'_winner']&&existing[m.key+'_result'])pickSeries(m.key,existing[m.key+'_winner'],existing[m.key+'_result'],si);
        if(m.hasMvp){const el=document.getElementById('mvp_'+m.key);if(el&&existing[m.key+'_mvp'])el.value=existing[m.key+'_mvp'];}
      }
      if(si===1){for(const p of PREBETS){const el=document.getElementById('pre_'+p.key);if(el&&existing[p.key])el.value=existing[p.key];}}
    }
    for(const b of bonuses){if(existing['bonus_'+b.id])pickBonus(b.id,existing['bonus_'+b.id]);}
  }
}

function showNextBonus(currentIdx){
  document.getElementById('bbc_'+currentIdx).style.display='none';
  const next=document.getElementById('bbc_'+(currentIdx+1));
  if(next)next.style.display='';
}

function pickPlayin(mk,teamName,si){
  CBD[mk]=teamName;
  document.querySelectorAll(`[id^="pb_${mk}_"]`).forEach(b=>b.classList.toggle('selected',b.textContent.trim()===teamName));
}
function pickSeries(mk,teamName,result,si){
  if(si!=='0b')si=isNaN(parseInt(si))?si:parseInt(si);
  CBD[mk+'_winner']=teamName;CBD[mk+'_result']=result;
  document.querySelectorAll(`[id^="bo_${mk}_"]`).forEach(b=>b.classList.remove('sel-home','sel-away'));
  const t=getTeams(si,mk);
  const isHome=teamName.toLowerCase().trim()===(t.home||'').toLowerCase().trim();
  const btn=document.getElementById(`bo_${mk}_${isHome?'h':'a'}_${result.replace('-','')}`);
  if(btn)btn.classList.add(isHome?'sel-home':'sel-away');
}
function pickBonus(bonusId,val){
  CBD['bonus_'+bonusId]=val;
  document.querySelectorAll(`[id^="bopt_${bonusId}_"]`).forEach(b=>b.classList.toggle('selected',b.getAttribute('data-val')===val));
}

function autoFillBets(si){
  if(si!=='0b')si=isNaN(parseInt(si))?si:parseInt(si);
  const matches=STAGE_MATCHES[si]||[];
  
  if(si===0||si==='0b'){
    // Playin: pick random winner for each match
    for(const m of matches){
      const t=getTeams(si,m.key);
      const teams=[t.home,t.away].filter(Boolean);
      if(!teams.length)continue;
      const pick=teams[Math.floor(Math.random()*teams.length)];
      pickPlayin(m.key,pick,si);
    }
  } else {
    // Series: pick random team + random result for unlocked series
    for(const m of matches){
      if(isSeriesLocked(si,m.key))continue; // skip locked series
      const t=getTeams(si,m.key);
      const teams=[t.home,t.away].filter(Boolean);
      if(!teams.length)continue;
      const pick=teams[Math.floor(Math.random()*teams.length)];
      const result=GAPS[Math.floor(Math.random()*GAPS.length)];
      pickSeries(m.key,pick,result,si);
      if(m.hasMvp){
        // Leave MVP empty for user to fill
      }
    }
    // Pre-bets for stage 1
    if(si===1&&!isPreBetsLocked()){
      const s1teams=[];
      const eastT=[],westT=[];
      for(const m of matches){
        const t=getTeams(1,m.key);
        if(m.conf==='east'){if(t.home)eastT.push(t.home);if(t.away)eastT.push(t.away);}
        else{if(t.home)westT.push(t.home);if(t.away)westT.push(t.away);}
      }
      const allT=[...eastT,...westT];
      if(allT.length){
        const rChamp=allT[Math.floor(Math.random()*allT.length)];
        const rEast=eastT.length?eastT[Math.floor(Math.random()*eastT.length)]:'';
        const rWest=westT.length?westT[Math.floor(Math.random()*westT.length)]:'';
        CBD['champion']=rChamp;CBD['east_champ']=rEast;CBD['west_champ']=rWest;
        const ec=document.getElementById('pre_champion');
        const ee=document.getElementById('pre_east_champ');
        const ew=document.getElementById('pre_west_champ');
        if(ec)ec.value=rChamp;if(ee)ee.value=rEast;if(ew)ew.value=rWest;
      }
    }
  }
  
  // Auto-fill bonus bets
  const bonuses=getBonusBets(si).filter(b=>!isSingleBonusLocked(si,b));
  for(const b of bonuses){
    if(b.answers&&b.answers.length){
      const pick=b.answers[Math.floor(Math.random()*b.answers.length)];
      pickBonus(b.id,pick);
    }
  }
  
  toast('🎲 מילוי אוטומטי הושלם — תוכל לשנות לפני השמירה');
}
window.autoFillBets=autoFillBets;

async function clearBets(si){
  if(si!=='0b')si=isNaN(parseInt(si))?si:parseInt(si);
  CBD={};
  document.querySelectorAll('.bet-opt,.team-btn,.bonus-opt').forEach(b=>b.classList.remove('sel-home','sel-away','selected','sel-bonus'));
  await updateDoc(doc(db,'leagues',currentLeague),{[`bets.${currentUser.uid}.stage${si}`]:null});
  toast('✅ הימורים נוקו!');
}
window.clearBets=clearBets;

async function saveBet(si){
  if(si!=='0b')si=isNaN(parseInt(si))?si:parseInt(si);
  const matches=STAGE_MATCHES[si];
  for(const m of matches){if(m.hasMvp){const el=document.getElementById('mvp_'+m.key);if(el)CBD[m.key+'_mvp']=el.value.trim();}}
  if(si===1){for(const p of PREBETS){const el=document.getElementById('pre_'+p.key);if(el)CBD[p.key]=el.value.trim();}}
  try{
    await updateDoc(doc(db,'leagues',currentLeague),{[`bets.${currentUser.uid}.stage${si}`]:CBD});
    toast('✅ הימורים נשמרו!');
  }catch(e){toast('❌ שגיאה: '+e.message);}
}

// ── ADMIN ──
async function initGlobalSettingsIfNeeded(){
  if(!globalData.stageLocked){
    await setDoc(doc(db,'global','settings'),{
      currentStage: 0,
      stageLocked: [false,false,false,false,false,false],
      seriesLocked: {},
      teams: {stage0:{},stage0b:{},stage1:{},stage2:{},stage3:{},stage4:{}},
      results: {stage0:null,stage0b:null,stage1:null,stage2:null,stage3:null,stage4:null},
      bonusBets: {stage0:[]},
      bonusResults: {stage0:{}}
    },{merge:true});
  }
}

function renderAdmin(){
  const ld=currentLeagueData;
  const _sv=document.getElementById('adminStageSelect').value;
  const _s=_sv==='0b'?'0b':parseInt(_sv);
  const acsIdx=STAGE_KEYS.indexOf(getGlobal('currentStage',_s));
  const _locked=getGlobal('stageLocked',[false,false,false,false,false,false]);
  const _curIdx=STAGE_KEYS.indexOf(getGlobal('currentStage',0));
  document.getElementById('adminCurrentStage').textContent=(STAGE_NAMES[_curIdx]||'')+(_locked[_curIdx]?' 🔒':' 🟢');
  const statusEl=document.getElementById('allStageLockStatus');
  if(statusEl){
    statusEl.innerHTML=STAGE_SHORT.map((s,i)=>{
      const lk=_locked[i]||false;
      return `<span style="padding:3px 8px;border-radius:6px;font-size:0.75rem;border:1px solid ${lk?'var(--green)':'var(--border)'};color:${lk?'var(--green)':'var(--text2)'};background:${lk?'rgba(0,230,118,0.1)':'transparent'}">${s} ${lk?'🔒':'🔓'}</span>`;
    }).join('');
  }
  document.getElementById('adminStageSelect').value=getGlobal('currentStage',0);
  const link=`${location.origin}${location.pathname}?code=${ld.code}`;
  document.getElementById('adminShareLink').value=link;
  document.getElementById('adminLeagueCode').textContent=ld.code;
  renderAutoLockList();
}

// TEAM SETUP
function renderTeamSetupForm(){
  const tsiRaw=document.getElementById('teamSetupStageSelect').value;
  const si=tsiRaw==='0b'?'0b':parseInt(tsiRaw);
  const matches=STAGE_MATCHES[si],form=document.getElementById('teamSetupForm');
  let html='';
  if(si==='0b'){
    html+=`<div class="info-box">🔄 הקבוצות בגמר הפליי-אין מחושבות <strong>אוטומטית</strong> מתוצאות שלב א של הפליי-אין:<br>• <strong>מזרח:</strong> מפסידת #7מול8 נגד מנצחת #9מול10<br>• <strong>מערב:</strong> מפסידת #7מול8 נגד מנצחת #9מול10</div>`;
  } else {
    for(const m of matches){
      const t=getTeams(si,m.key);
      const sLk=isSeriesLocked(si,m.key);
      html+=`<div class="ts-row" style="border:1px solid ${sLk?'rgba(0,230,118,0.25)':'var(--border)'};border-radius:8px;padding:8px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span class="ts-label" style="margin:0">${m.label}</span>
          <button data-si="${si}" data-mk="${m.key}" onclick="toggleSeriesLock(this.dataset.si,this.dataset.mk)"
            style="padding:3px 10px;border-radius:6px;border:1px solid ${sLk?'var(--green)':'var(--border)'};background:${sLk?'rgba(0,230,118,0.15)':'transparent'};color:${sLk?'var(--green)':'var(--text2)'};cursor:pointer;font-size:0.75rem">
            ${sLk?'🔒 נעול':'🔓 נעל סדרה'}
          </button>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <input class="ts-inp" id="ts_${m.key}_home" value="${t.home}" placeholder="ביתית..." style="flex:1">
          <span class="vs-badge">מול</span>
          <input class="ts-inp" id="ts_${m.key}_away" value="${t.away}" placeholder="אורחת..." style="flex:1">
        </div>
      </div>`;
    }
    html+=`<button class="btn btn-secondary btn-sm" style="margin-top:9px" onclick="saveTeamSetup(this.dataset.si)" data-si="${si}">💾 שמור קבוצות</button>`;
  }
  form.innerHTML=html;
}
async function saveTeamSetup(si){
  if(si!=='0b')si=isNaN(parseInt(si))?si:parseInt(si);
  console.log('saveTeamSetup called with si=',si,'type=',typeof si);
  if(si==='0b'){toast("ℹ️ הקבוצות בגמר הפליי-אין מחושבות אוטומטית מתוצאות שלב א של הפליי-אין");return;}
  // Build nested object for proper Firestore storage
  const stageTeams={};
  // Read directly from all team inputs in the form
  const allInputs=document.querySelectorAll('[id^="ts_"][id$="_home"],[id^="ts_"][id$="_away"]');
  allInputs.forEach(inp=>{
    const parts=inp.id.split('_'); // ts, key, home/away
    const side=parts[parts.length-1]; // home or away
    const key=parts.slice(1,parts.length-1).join('_'); // e.g. e1, w1, e_final
    if(!stageTeams[key])stageTeams[key]={home:'',away:''};
    stageTeams[key][side]=inp.value.trim();
  });
  // Also try getElementById as fallback
  for(const m of STAGE_MATCHES[si]||[]){
    if(!stageTeams[m.key]||(!stageTeams[m.key].home&&!stageTeams[m.key].away)){
      const h=document.getElementById('ts_'+m.key+'_home'),a=document.getElementById('ts_'+m.key+'_away');
      if(h||a)stageTeams[m.key]={home:h?h.value.trim():'',away:a?a.value.trim():''};
    }
  }
  console.log('stageTeams=',JSON.stringify(stageTeams));
  try {
    // Read current teams, update the stage, write back
    const currentTeams=getGlobal('teams',{});
    const newTeams={...currentTeams,[`stage${si}`]:stageTeams};
    await setDoc(doc(db,'global','settings'),{teams:newTeams},{merge:true});
    toast('✅ קבוצות נשמרו בכל הליגות!');
  } catch(e) {
    console.error('saveTeamSetup error:',e);
    toast('❌ שגיאה: '+e.message);
  }
}

// ── BONUS BETS ADMIN ──
function updateBonusSeries(si,i,val){const key=si==='0b'?'0b':parseInt(si);if(bonusBetDraft[key]&&bonusBetDraft[key][i])bonusBetDraft[key][i].seriesKey=val;}
window.updateBonusSeries=updateBonusSeries;
function updateBonusQuestion(si,i,val){if(!si||si==='0b'?bonusBetDraft['0b']:bonusBetDraft[parseInt(si)||si]);const key=si==='0b'?'0b':parseInt(si);if(bonusBetDraft[key]&&bonusBetDraft[key][i])bonusBetDraft[key][i].question=val;}
function updateBonusPoints(si,i,val){const key=si==='0b'?'0b':parseInt(si);if(bonusBetDraft[key]&&bonusBetDraft[key][i])bonusBetDraft[key][i].points=parseFloat(val)||1;}
function updateBonusAnswer(si,i,ai,val){const key=si==='0b'?'0b':parseInt(si);if(bonusBetDraft[key]&&bonusBetDraft[key][i])bonusBetDraft[key][i].answers[parseInt(ai)]=val;}
function renderBonusAdmin(){
  const bsiRaw=document.getElementById('bonusStageSelect').value;
  const si=bsiRaw==='0b'?'0b':parseInt(bsiRaw);
  const bonuses=getBonusBets(si);
  bonusBetDraft[si]=JSON.parse(JSON.stringify(bonuses)); // deep copy
  renderBonusAdminList(si);
}

function renderBonusAdminList(si){
  const bonuses=bonusBetDraft[si]||[];
  const list=document.getElementById('bonusAdminList');
  if(!bonuses.length){list.innerHTML='<div style="color:var(--text2);font-size:0.82rem;padding:8px 0">אין הימורי בונוס לשלב זה</div>';return;}
  list.innerHTML=bonuses.map((b,i)=>{
    const answers=b.answers||[];
    const ansHtml=answers.map((a,ai)=>`<div class="bonus-answer-row">
      <input type="text" value="${a}" placeholder="תשובה אפשרית..." data-si="${si}" data-idx="${i}" data-aidx="${ai}" onchange="updateBonusAnswer(this.dataset.si,this.dataset.idx,this.dataset.aidx,this.value)">
      <button class="remove-ans" onclick="removeBonusAnswer(this.dataset.si,this.dataset.idx,this.dataset.aidx)" data-si="${si}" data-idx="${i}" data-aidx="${ai}">✕</button>
    </div>`).join('');
    // Build series options for this stage
    const stageMatches=STAGE_MATCHES[typeof si==='string'&&si!=='0b'?parseInt(si):si]||[];
    const seriesOpts=stageMatches.map(m=>{const t=getTeams(si,m.key);const lbl=t.home&&t.away?`${t.home} מול ${t.away}`:m.label;return`<option value="${m.key}" ${b.seriesKey===m.key?'selected':''}>${lbl}</option>`;}).join('');
    
    return`<div class="bonus-admin-card">
      <button class="remove-btn" onclick="removeBonusBet(this.dataset.si,this.dataset.idx)" data-si="${si}" data-idx="${i}">✕ הסר</button>
      <div class="form-group" style="margin-bottom:8px"><label>שאלה</label>
        <input type="text" value="${b.question}" placeholder="השאלה..." style="background:var(--dark);border:1.5px solid rgba(255,215,0,0.3);border-radius:7px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.84rem;padding:7px 10px;width:100%" data-si="${si}" data-idx="${i}" onchange="updateBonusQuestion(this.dataset.si,this.dataset.idx,this.value)">
      </div>
      <div class="form-group" style="margin-bottom:8px"><label>נקודות</label>
        <input type="number" value="${b.points}" min="0.5" step="0.5" style="background:var(--dark);border:1.5px solid rgba(255,215,0,0.3);border-radius:7px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.84rem;padding:7px 10px;width:100px" data-si="${si}" data-idx="${i}" onchange="updateBonusPoints(this.dataset.si,this.dataset.idx,this.value)">
      </div>
      ${stageMatches.length?`<div class="form-group" style="margin-bottom:8px"><label>🔗 שייך לסדרה (ננעל עם הסדרה)</label>
        <select style="background:var(--dark);border:1.5px solid rgba(255,215,0,0.3);border-radius:7px;color:var(--text);font-family:'Heebo',sans-serif;font-size:0.82rem;padding:6px 10px;width:100%" data-si="${si}" data-idx="${i}" onchange="updateBonusSeries(this.dataset.si,this.dataset.idx,this.value)">
          <option value="">ללא שיוך — נעל עם שלב</option>${seriesOpts}
        </select></div>`:''}
      <label style="font-size:0.78rem;color:var(--text2);font-weight:600;display:block;margin-bottom:6px">תשובות אפשריות</label>
      <div class="bonus-answers">${ansHtml}</div>
      <button class="btn-ghost" style="margin-top:8px;font-size:0.78rem" onclick="addBonusAnswer(this.dataset.si,this.dataset.idx)" data-si="${si}" data-idx="${i}">➕ הוסף תשובה</button>
    </div>`;
  }).join('');
  list.insertAdjacentHTML('beforeend',`<button class="btn btn-primary" style="margin-top:10px" onclick="saveBonusBets(this.dataset.si)" data-si="${si}">💾 שמור הימורי בונוס</button>`);
}

function addBonusBet(){
  const bsiRaw2=document.getElementById('bonusStageSelect').value;const si=bsiRaw2==='0b'?'0b':parseInt(bsiRaw2);
  if(!bonusBetDraft[si])bonusBetDraft[si]=[];
  bonusBetDraft[si].push({id:'b'+Date.now(),question:'',points:1,answers:['',''],seriesKey:''});
  renderBonusAdminList(si);
}
function removeBonusBet(si,i){bonusBetDraft[si].splice(i,1);renderBonusAdminList(si);}
function addBonusAnswer(si,i){bonusBetDraft[si][i].answers.push('');renderBonusAdminList(si);}
function removeBonusAnswer(si,i,ai){bonusBetDraft[si][i].answers.splice(ai,1);renderBonusAdminList(si);}
async function saveBonusBets(si){
  if(si!=='0b')si=isNaN(parseInt(si))?si:parseInt(si);
  const bonuses=bonusBetDraft[si]||[];
  // collect latest values from DOM
  const list=document.querySelectorAll(`#bonusAdminList .bonus-admin-card`);
  list.forEach((card,i)=>{
    const qEl=card.querySelector('input[type=text]');
    const pEl=card.querySelector('input[type=number]');
    const aEls=card.querySelectorAll('.bonus-answer-row input');
    if(bonuses[i]){
      if(qEl)bonuses[i].question=qEl.value.trim();
      if(pEl)bonuses[i].points=parseFloat(pEl.value)||1;
      bonuses[i].answers=Array.from(aEls).map(el=>el.value.trim()).filter(Boolean);
    }
  });
  const bKey=getBonusStageKey(si);
  await setDoc(doc(db,'global','settings'),{bonusBets:{[bKey]:bonuses}},{merge:true});
  toast('✅ הימורי בונוס נשמרו בכל הליגות!');
}

// RESULTS
function renderResultForm(){
  const siRaw2=document.getElementById('resultStageSelect').value;
  const si=siRaw2==='0b'?'0b':parseInt(siRaw2);
  const matches=STAGE_MATCHES[si],result=(getGlobal('results',{}))['stage'+si]||{};
  const content=document.getElementById('resultFormContent');let html='';
  if(si===0||si==='0b'){
    for(const m of matches){
      let lbl,opts;
      if(si==='0b'){
        const ft=getPlayinFinalTeams(m.conf);
        lbl=m.label;
        opts=[ft.home,ft.away].filter(Boolean);
        if(!opts.length)opts=['מפסידת #7מול8','מנצחת #9מול10'];
      } else {
        const t=getTeams(si,m.key);
        lbl=t.home&&t.away?`${t.home} מול ${t.away}`:m.label;
        opts=[t.home||'קבוצה 1',t.away||'קבוצה 2'];
      }
      html+=`<div class="form-group"><label>🏀 ${lbl}</label><select id="res_${m.key}"><option value="">בחר מנצחת...</option>${opts.map(o=>`<option value="${o}" ${result[m.key]===o?'selected':''}>${o}</option>`).join('')}</select></div>`;
    }
  } else {
    for(const m of matches){
      const t=getTeams(si,m.key),home=t.home||'ביתית',away=t.away||'אורחת';
      const lbl=t.home&&t.away?`${home} מול ${away}`:m.label;
      const allOpts=[...GAPS.map(r=>({w:home,r,l:`${home} ${r}`})),...GAPS.map(r=>({w:away,r,l:`${away} ${r}`}))];
      const curV=result[m.key+'_winner']&&result[m.key+'_result']?`${result[m.key+'_winner']}|${result[m.key+'_result']}`:'';
      html+=`<div class="form-group"><label>🏀 ${lbl}</label>
        <select id="res_${m.key}"><option value="">בחר תוצאה...</option>${allOpts.map(o=>{const v=`${o.w}|${o.r}`;return`<option value="${v}" ${curV===v?'selected':''}>${o.l}</option>`;}).join('')}</select>
      </div>`;
      if(m.hasMvp)html+=`<div class="form-group"><label>🏅 MVP</label><input type="text" id="res_${m.key}_mvp" value="${result[m.key+'_mvp']||''}" placeholder="שם שחקן..."></div>`;
    }
    // Pre-bets results moved to stage 4 (finals)
  }
  // Bonus results
  const bonuses=getBonusBets(si),bonusResults=getBonusResults(si);

  if(bonuses.length){
    html+=`<div class="separator"></div><div style="font-weight:700;color:var(--gold);margin-bottom:9px">⭐ תוצאות הימורי בונוס</div>`;
    for(const b of bonuses){
      const opts=b.answers||[];
      html+=`<div class="form-group"><label>${b.question} (${b.points} נק')</label>
        <select id="bres_${b.id}">
          <option value="" ${!bonusResults[b.id]?'selected':''}>בחר תשובה נכונה...</option>
          ${opts.map(a=>`<option value="${a}" ${bonusResults[b.id]===a&&bonusResults[b.id]!==''?'selected':''}>${a}</option>`).join('')}
        </select></div>`;
    }
  }
  // Add pre-bets results at stage 4
  if(si===4){
    const r1=(getGlobal('results',{}))['stage1']||{};
    const allS1=[...STAGE_MATCHES[1]];
    const eastT=[],westT=[];
    for(const m of allS1){const t=getTeams(1,m.key);if(m.conf==='east'){if(t.home)eastT.push(t.home);if(t.away)eastT.push(t.away);}else{if(t.home)westT.push(t.home);if(t.away)westT.push(t.away);}}
    const allT=[...eastT,...westT];
    const mkS=(teams,cur)=>teams.map(t=>`<option value="${t}" ${cur===t?'selected':''}>${t}</option>`).join('');
    html+=`<div class="separator"></div><div style="font-weight:700;color:var(--orange);margin:12px 0 9px">🏆 תוצאות הימורי מראש</div>`;
    html+=`<div class="form-group"><label>🏆 אלוף NBA</label><select id="res_champion"><option value="">בחר...</option>${mkS(allT,r1.champion||'')}</select></div>`;
    html+=`<div class="form-group"><label>🔵 אלופת המזרח</label><select id="res_east_champ"><option value="">בחר...</option>${mkS(eastT,r1.east_champ||'')}</select></div>`;
    html+=`<div class="form-group"><label>🔴 אלופת המערב</label><select id="res_west_champ"><option value="">בחר...</option>${mkS(westT,r1.west_champ||'')}</select></div>`;
  }
  html+=`<button class="btn btn-secondary btn-sm" onclick="saveResults(this.dataset.si)" data-si="${si}">💾 שמור תוצאות</button>`;
  content.innerHTML=html;
}

async function saveResults(si){
  // Normalize si - could be string from dataset
  if(si!=='0b')si=isNaN(parseInt(si))?si:parseInt(si);
  const matches=STAGE_MATCHES[si];
  let result={};
  if(si===0){for(const m of matches){const el=document.getElementById('res_'+m.key);if(el&&el.value)result[m.key]=el.value;}}
  else if(si==='0b'){
    // Play-in finals: single game, winner only
    for(const m of matches){
      const el=document.getElementById('res_'+m.key);
      if(el&&el.value)result[m.key]=el.value;
    }
  } else{
    for(const m of matches){
      const el=document.getElementById('res_'+m.key);
      if(el&&el.value){const p=el.value.split('|');result[m.key+'_winner']=p[0];if(p[1]!==undefined)result[m.key+'_result']=p[1];}
      if(m.hasMvp){const e2=document.getElementById('res_'+m.key+'_mvp');if(e2)result[m.key+'_mvp']=e2.value.trim();}
    }
    // Pre-bets now in stage 4
    if(si===4){
      // Save pre-bet results to stage1 results
      const r1update={};
      const champEl=document.getElementById('res_champion');
      const eastEl=document.getElementById('res_east_champ');
      const westEl=document.getElementById('res_west_champ');
      if(champEl)r1update.champion=champEl.value;
      if(eastEl)r1update.east_champ=eastEl.value;
      if(westEl)r1update.west_champ=westEl.value;
      if(Object.keys(r1update).length){
        const existing1=(getGlobal('results',{}))['stage1']||{};
        await setDoc(doc(db,'global','settings'),{results:{stage1:{...existing1,...r1update}}},{merge:true});
      }
    }
  }
  // If result is empty, save null to clear it
  const resultToSave=Object.keys(result).length>0?result:null;
  // If clearing stage0, also clear stage0b (teams depend on stage0 results)
  if(si===0&&resultToSave===null){
    await setDoc(doc(db,'global','settings'),{results:{stage0:null,stage0b:null}},{merge:true});
    toast('✅ תוצאות שלב א ושלב ב אופסו!');
    return;
  }
  const bonusResults={};
  const bonuses=getBonusBets(si);
  for(const b of bonuses){const el=document.getElementById('bres_'+b.id);if(el){if(el.value)bonusResults[b.id]=el.value;else bonusResults[b.id]='';} }
  const bKey2=getBonusStageKey(si);
  await setDoc(doc(db,'global','settings'),{results:{['stage'+si]:resultToSave},bonusResults:{[bKey2]:bonusResults}},{merge:true});
  toast('✅ תוצאות נשמרו בכל הליגות!');
  
  // If clearing results (null), reset bets for future stages
  if(resultToSave===null){
    const futureStages={0:['0b',1,2,3,4],'0b':[1,2,3,4],1:[2,3,4],2:[3,4],3:[4],4:[]};
    const toReset=futureStages[si]||[];
    if(toReset.length>0){
      // Reset bets for all league members for future stages
      const ld=currentLeagueData;
      if(ld&&ld.members){
        const updates={};
        for(const uid of ld.members){
          for(const fsi of toReset){
            updates[`bets.${uid}.stage${fsi}`]=null;
          }
        }
        if(Object.keys(updates).length>0){
          await updateDoc(doc(db,'leagues',currentLeague),updates);
        }
      }
      // Also clear series locks for future stages
      const serLocked=getGlobal('seriesLocked',{});
      const newSerLocked={};
      for(const [k,v] of Object.entries(serLocked)){
        const stagePart=k.split('_')[0];
        const stageNum=stagePart==='0b'?'0b':parseInt(stagePart);
        if(!toReset.map(String).includes(String(stageNum))){
          newSerLocked[k]=v;
        }
      }
      await setDoc(doc(db,'global','settings'),{seriesLocked:newSerLocked},{merge:true});
      toast('✅ תוצאות אופסו + הימורי שלבים עתידיים אופסו!');
    }
  }
}

async function setCurrentStage(){
  const sv=document.getElementById('adminStageSelect').value;
  const s=sv==='0b'?'0b':parseInt(sv);
  const updates={currentStage:s};
  // Initialize stageLocked if not set
  if(!globalData.stageLocked){
    updates.stageLocked=[false,false,false,false,false,false];
  }
  await setDoc(doc(db,'global','settings'),updates,{merge:true});
  toast('✅ שלב עודכן בכל הליגות!');
}
async function toggleSeriesLock(si,mk){
  if(si!=='0b')si=isNaN(parseInt(si))?si:parseInt(si);
  const key=getSeriesLockedKey(si,mk);
  const cur=getGlobal('seriesLocked',{});
  const newVal=!cur[key];
  console.log('toggleSeriesLock key=',key,'newVal=',newVal,'cur=',JSON.stringify(cur));
  try{
    await updateDoc(doc(db,'global','settings'),{[`seriesLocked.${key}`]:newVal});
    toast(newVal?'🔒 סדרה ננעלה':'🔓 סדרה נפתחה');
  }catch(e){
    console.error('toggleSeriesLock error:',e);
    toast('❌ '+e.message);
  }
}
window.toggleSeriesLock=toggleSeriesLock;

async function toggleStageLock(){
  const sv=document.getElementById('adminStageSelect').value;
  const s=sv==='0b'?'0b':parseInt(sv);
  const sIdx=STAGE_KEYS.indexOf(s);
  if(sIdx<0){toast('שגיאה');return;}
  const currentLocked=getGlobal('stageLocked',[false,false,false,false,false,false]);
  const newLocked=[...currentLocked];
  while(newLocked.length<6)newLocked.push(false);
  newLocked[sIdx]=!newLocked[sIdx];
  await setDoc(doc(db,'global','settings'),{stageLocked:newLocked},{merge:true});
  toast(newLocked[sIdx]?'🔒 שלב ננעל בכל הליגות':'🔓 שלב נפתח בכל הליגות');
}

// ── UTILS ──
// ── AUTO LOCK ──
function renderAutoLockList(){
  const locks=getGlobal('autoLocks',{});
  const list=document.getElementById('autoLockList');
  if(!list)return;
  const entries=Object.entries(locks);
  if(!entries.length){list.innerHTML='<div style="color:var(--text2);font-size:0.78rem">אין נעילות אוטומטיות מוגדרות</div>';return;}
  list.innerHTML=entries.map(([key,ts])=>{
    let name='';
    if(key.startsWith('series_')){
      const parts=key.split('_');// series_1_e1
      const si=parseInt(parts[1]);
      const mk=parts[2];
      const t=getTeams(si,mk);
      name='🏀 '+(t.home&&t.away?`${t.home} מול ${t.away}`:mk);
    } else {
      const normKey=key==='0b'?'0b':parseInt(key);
      name=STAGE_NAMES[STAGE_KEYS.indexOf(normKey)]||key;
    }
    const d=new Date(ts);
    const now=Date.now();
    let locked=false;
    if(key.startsWith('series_')){
      const parts=key.split('_');locked=isSeriesLocked(parseInt(parts[1]),parts[2]);
    } else {
      const normKey=key==='0b'?'0b':parseInt(key);
      locked=(getGlobal('stageLocked',[]))[STAGE_KEYS.indexOf(normKey)]||false;
    }
    const status=locked?'<span style="color:var(--green);font-size:0.7rem">✅ ננעל</span>':
                 ts<now?'<span style="color:var(--red);font-size:0.7rem">⚡ פג תוקף</span>':
                 '<span style="color:var(--gold);font-size:0.7rem">⏳ ממתין</span>';
    return `<div style="display:flex;align-items:center;justify-content:space-between;background:var(--dark);border-radius:8px;padding:7px 10px;margin-bottom:6px;font-size:0.8rem;">
      <span style="font-weight:700">${name}</span>
      <span style="color:var(--text2)">${d.toLocaleString('he-IL')}</span>
      ${status}
      <button onclick="removeAutoLock('${key}')" style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:0.8rem;padding:0 4px">✕</button>
    </div>`;
  }).join('');
}

function updateAutoLockTargets(){
  const type=document.getElementById('autoLockType').value;
  const sel=document.getElementById('autoLockTarget');
  if(type==='stage'){
    sel.innerHTML=`<option value="0">פליי-אין א</option><option value="0b">פליי-אין גמר</option>
      <option value="1">סיבוב ראשון</option><option value="2">סיבוב שני</option>
      <option value="3">גמר איזורי</option><option value="4">גמר NBA</option>`;
  } else {
    // Build series list from all stages
    const opts=[];
    const seriesStages=[1,2,3,4];
    for(const si of seriesStages){
      for(const m of STAGE_MATCHES[si]||[]){
        const t=getTeams(si,m.key);
        const lbl=t.home&&t.away?`${t.home} מול ${t.away}`:m.label;
        opts.push(`<option value="series_${si}_${m.key}">${STAGE_SHORT[STAGE_KEYS.indexOf(si)]}: ${lbl}</option>`);
      }
    }
    sel.innerHTML=opts.join('');
  }
}
window.updateAutoLockTargets=updateAutoLockTargets;

async function addAutoLock(){
  const lockType=document.getElementById('autoLockType').value;
  const targetVal=document.getElementById('autoLockTarget').value;
  const timeVal=document.getElementById('autoLockTime').value;
  if(!timeVal){toast('⚠️ בחר תאריך ושעה');return;}
  const ts=new Date(timeVal).getTime();
  if(ts<=Date.now()){toast('⚠️ הזמן חייב להיות בעתיד');return;}
  const key=lockType==='series'?targetVal:targetVal; // series key: "series_1_e1", stage key: "0","1" etc
  const curLocks=getGlobal('autoLocks',{});
  const newLocks={...curLocks,[key]:ts};
  await setDoc(doc(db,'global','settings'),{autoLocks:newLocks},{merge:true});
  document.getElementById('autoLockTime').value='';
  toast('✅ נעילה אוטומטית נקבעה!');
}

async function removeAutoLock(stageKey){
  // Remove by setting to null (Firestore delete field)
  const curLocks=getGlobal('autoLocks',{});
  const newLocks={...curLocks};
  delete newLocks[stageKey];
  await setDoc(doc(db,'global','settings'),{autoLocks:newLocks},{merge:true});
  toast('🗑️ נעילה אוטומטית הוסרה');
}

// Check auto-locks every 30 seconds
function startAutoLockChecker(){
  // Run immediately on start, then every 30 seconds
  async function checkLocks(){
    const locks=getGlobal('autoLocks',{});
    console.log('AutoLock check, locks=',JSON.stringify(locks));
    if(!locks||!Object.keys(locks).length)return;
    const now=Date.now();
    const stageLocked=[...(getGlobal('stageLocked',[false,false,false,false,false,false]))];
    let changed=false;
    for(const [stageKey,ts] of Object.entries(locks)){
      const tsNum=typeof ts==='number'?ts:(ts?.seconds?ts.seconds*1000:0);
      if(tsNum>0&&tsNum<=now){
        if(stageKey.startsWith('series_')){
          // Series lock
          const parts=stageKey.split('_');
          const si=parseInt(parts[1]);const mk=parts[2];
          if(!isSeriesLocked(si,mk)){
            const curSL=getGlobal('seriesLocked',{});
            await setDoc(doc(db,'global','settings'),{seriesLocked:{...curSL,[si+'_'+mk]:true}},{merge:true});
            changed=false; // already saved
            toast('⏰ סדרה ננעלה אוטומטית!');
            console.log('Auto-locking series',si,mk);
          }
        } else {
          const normKey=stageKey==='0b'?'0b':parseInt(stageKey);
          const idx=STAGE_KEYS.indexOf(normKey);
          if(idx>=0&&!stageLocked[idx]){
            stageLocked[idx]=true;
            changed=true;
            console.log('Auto-locking stage',stageKey,'at',new Date(tsNum).toLocaleString());
          }
        }
      }
    }
    if(changed){
      await setDoc(doc(db,'global','settings'),{stageLocked},{merge:true});
      toast('⏰ שלב ננעל אוטומטית!');
    }
    if(document.getElementById('autoLockList'))renderAutoLockList();
  }
  checkLocks(); // run immediately
  setInterval(checkLocks,30000);
}

function renderPrebetsTab(){
  console.log('renderPrebetsTab called');
  const ld=currentLeagueData;
  console.log('members:',ld?.members?.length,'bets:',JSON.stringify(Object.keys(ld?.bets||{})));
  const members=ld.members||[],memberInfo=ld.memberInfo||{};
  const r1=(getGlobal('results',{}))['stage1']||{};
  const content=document.getElementById('prebetsContent');
  if(!members.length){content.innerHTML='<div class="empty-state"><p>אין משתתפים</p></div>';return;}
  
  const cards=members.map(uid=>{
    const info=memberInfo[uid]||{username:uid};
    const bet=((ld.bets||{})[uid]||{})['stage1']||{};
    const bChamp=bet.champion||'-';
    const bEast=bet.east_champ||'-';
    const bWest=bet.west_champ||'-';
    
    const champCls=r1.champion?(bChamp.toLowerCase()===r1.champion.toLowerCase()?'correct':'wrong'):'pending';
    const eastCls=r1.east_champ?(bEast.toLowerCase()===r1.east_champ.toLowerCase()?'correct':'wrong'):'pending';
    const westCls=r1.west_champ?(bWest.toLowerCase()===r1.west_champ.toLowerCase()?'correct':'wrong'):'pending';
    
    return `<div class="bet-card">
      <div class="bet-header">
        <div><div class="bet-player-username">${info.username||uid}</div><div class="bet-player-name">${info.displayName||''}</div></div>
      </div>
      <div class="bet-item"><span class="bet-label">🏆 אלוף NBA</span><span class="bet-value ${champCls}">${bChamp}</span></div>
      <div class="bet-item"><span class="bet-label">🔵 אלופת המזרח</span><span class="bet-value ${eastCls}">${bEast}</span></div>
      <div class="bet-item"><span class="bet-label">🔴 אלופת המערב</span><span class="bet-value ${westCls}">${bWest}</span></div>
    </div>`;
  }).join('');
  
  let resultsHtml='';
  if(r1.champion||r1.east_champ||r1.west_champ){
    resultsHtml=`<div class="card" style="margin-top:14px;border-color:rgba(79,195,247,0.3)"><div class="card-title" style="color:var(--blue)">📊 תוצאות אמיתיות</div>
      ${r1.champion?`<div class="bet-item"><span class="bet-label">🏆 אלוף NBA</span><span class="bet-value" style="color:var(--blue)">${r1.champion}</span></div>`:''}
      ${r1.east_champ?`<div class="bet-item"><span class="bet-label">🔵 אלופת המזרח</span><span class="bet-value" style="color:var(--blue)">${r1.east_champ}</span></div>`:''}
      ${r1.west_champ?`<div class="bet-item"><span class="bet-label">🔴 אלופת המערב</span><span class="bet-value" style="color:var(--blue)">${r1.west_champ}</span></div>`:''}
    </div>`;
  }
  content.innerHTML=`<div class="bets-grid">${cards}</div>${resultsHtml}`;
}

window.renderPrebetsTab=renderPrebetsTab;

function sendReminderEmail(){
  const ld=currentLeagueData;
  if(!ld){toast('⚠️ אין ליגה פעילה');return;}
  const members=ld.members||[];
  const memberInfo=ld.memberInfo||{};
  // Collect emails from users collection - we only have displayName/username
  // So we'll use the league link instead
  const link=`${location.origin}${location.pathname}?code=${ld.code}`;
  const cs=getGlobal('currentStage',0);
  const stageName=STAGE_NAMES[STAGE_KEYS.indexOf(cs)]||'';
  const subject=encodeURIComponent(`תזכורת: הזן הימורים — ${ld.name}`);
  const body=encodeURIComponent(`שלום,

תזכורת להזין את הימוריך עבור ${stageName} בליגה "${ld.name}".

כניסה לאתר:
${link}

בהצלחה!`);
  window.open(`mailto:?subject=${subject}&body=${body}`);
}
window.sendReminderEmail=sendReminderEmail;

function copyLink(){navigator.clipboard.writeText(document.getElementById('createdLeagueLink').value);toast('📋 הועתק!');}
function copyAdminLink(){navigator.clipboard.writeText(document.getElementById('adminShareLink').value);toast('📋 הועתק!');}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}

// ── DOM WIRING ──
// Wire auth tabs immediately (before module loads)
// Safe caller - works whether Firebase is ready or not yet
function _call(fn) {
  return function() {
    if(window[fn]) { window[fn](); }
    else {
      if(!window._pendingCalls) window._pendingCalls=[];
      window._pendingCalls.push(function(){ if(window[fn]) window[fn](); });
    }
  };
}

document.addEventListener('DOMContentLoaded', function() {
  // Auth tabs - work immediately
  function switchTabLocal(t) {
    document.querySelectorAll('.auth-tab').forEach((b,i)=>b.classList.toggle('active',(i===0&&t==='login')||(i===1&&t==='register')));
    document.getElementById('authLogin').style.display=t==='login'?'':'none';
    document.getElementById('authRegister').style.display=t==='register'?'':'none';
  }
  var tl=document.getElementById('authTabLogin');
  var tr=document.getElementById('authTabRegister');
  if(tl) tl.onclick=function(){ if(window.switchAuthTab) window.switchAuthTab('login'); else switchTabLocal('login'); };
  if(tr) tr.onclick=function(){ if(window.switchAuthTab) window.switchAuthTab('register'); else switchTabLocal('register'); };

  // Auth buttons
  var lb=document.getElementById('loginBtn');
  var rb=document.getElementById('registerBtn');
  var rst=document.getElementById('resetBtn');
  var rsnd=document.getElementById('resendBtn');
  if(lb) lb.onclick=function(){ if(window.doLogin) window.doLogin(); };
  if(rb) rb.onclick=function(){ if(window.doRegister) window.doRegister(); };
  if(rst) rst.onclick=function(){ if(window.doResetPassword) window.doResetPassword(); };
  if(rsnd) rsnd.onclick=function(){ if(window.doResendVerification) window.doResendVerification(); };

  // Enter key
  document.getElementById('loginPassword').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&window.doLogin) window.doLogin();
  });
});
