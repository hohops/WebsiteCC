// Quiz Diário de Ciência - script.js
// Fully integrated with Supabase for storage.
(function(){
	// --- CONFIGURE THESE ---
	const SUPABASE_URL = 'https://aezisthuybsmrelbuwth.supabase.co'; // Your Supabase URL
	const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlemlzdGh1eWJzbXJlbGJ1d3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNjA0MTgsImV4cCI6MjA4NjczNjQxOH0.HREGG4R2xqJ1jebkdHc5EY6VKwPj30uLm0ToMzWrm30';
	// ------------------------

	let supabase = null;
	if(window.supabase){
		supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
	}

	const STORAGE_KEYS = { CURRENT: 'qc_current', QUESTIONS: 'qc_questions' };
	const ADMIN_TOKEN = 'admin123';
	const $ = id => document.getElementById(id);
	const todayISO = () => new Date().toISOString().slice(0,10);

	// In-memory cache
	let questionsCache = [];
	let leaderShowAll = false;

	// Local storage helpers (fallback)
	function loadLocal(key, def){ try{const v=localStorage.getItem(key);return v?JSON.parse(v):def}catch(e){return def} }
	function saveLocal(key,val){ localStorage.setItem(key,JSON.stringify(val)) }

	// Seed default questions (only if no questions found)
	const defaultQuestions = [
		{question_text:'Qual é a unidade básica da vida?', option_a:'Átomo', option_b:'Célula', option_c:'Molécula', option_d:'Órgão', correct:'B'},
		{question_text:'Qual planeta é conhecido como Planeta Vermelho?', option_a:'Vênus', option_b:'Saturno', option_c:'Marte', option_d:'Júpiter', correct:'C'},
		{question_text:'Qual destes é uma fonte de energia renovável?', option_a:'Petróleo', option_b:'Carvão', option_c:'Vento', option_d:'Gás Natural', correct:'C'},
		{question_text:'Qual gás é mais abundante na atmosfera da Terra?', option_a:'Oxigênio', option_b:'Nitrogênio', option_c:'Dióxido de Carbono', option_d:'Hélio', correct:'B'},
		{question_text:'Qual é a velocidade aproximada da luz no vácuo?', option_a:'300.000 km/s', option_b:'30.000 km/s', option_c:'300 km/s', option_d:'3.000 km/s', correct:'A'},
		{question_text:'Qual é o principal órgão do sistema circulatório?', option_a:'Pulmões', option_b:'Fígado', option_c:'Coração', option_d:'Rim', correct:'C'}
	];

	// --- Supabase wrappers ---
	async function fetchQuestions(){
		console.log('Fetching questions from Supabase');
		const {data, error} = await supabase.from('questions').select('*').order('id', {ascending:true});
		if(error){ console.error('Error fetching questions:', error); return []; }
		console.log('Fetched questions:', data.length);
		return data.map(q=>({id:q.id,text:q.question_text,a:q.option_a,b:q.option_b,c:q.option_c,d:q.option_d,correct:q.correct}));
	}

	async function ensureSeedQuestions(){
		console.log('Ensuring seed questions');
		const {data,count} = await supabase.from('questions').select('id',{count:'exact'});
		if((count||0)===0){
			console.log('Seeding default questions');
			await supabase.from('questions').insert(defaultQuestions.map(q=>({question_text:q.question_text, option_a:q.option_a, option_b:q.option_b, option_c:q.option_c, option_d:q.option_d, correct:q.correct})))
		}
	}

	async function getProfilesForLeaderboard(){
		console.log('Fetching leaderboard from Supabase');
		const {data, error} = await supabase.from('profiles').select('*').order('points',{ascending:false});
		if(error){ console.error('Error fetching profiles:', error); return []; }
		console.log('Fetched profiles:', data.length);
		return data;
	}

	async function getProfileByUsername(username){
		console.log('Fetching profile for:', username);
		const {data, error} = await supabase.from('profiles').select('*').eq('username', username).limit(1).maybeSingle();
		if(error){ console.error('Error fetching profile:', error); return null; }
		console.log('Fetched profile:', data ? 'found' : 'not found');
		return data || null;
	}

	async function createProfile(username, password){
		console.log('Creating profile for:', username);
		const {data, error} = await supabase.from('profiles').insert({username, password, points:0}).select().maybeSingle();
		if(error){ console.error('Error creating profile:', error); return null; }
		console.log('Profile created:', data);
		return data;
	}

	async function updateProfilePoints(username, points, lastAnswered){
		console.log('Updating points for:', username, 'to', points);
		const {data, error} = await supabase.from('profiles').update({points, last_answer_date:lastAnswered}).eq('username', username).select().maybeSingle();
		if(error){ console.error('Error updating profile:', error); return null; }
		console.log('Profile updated:', data);
		return data;
	}

	async function insertAnswerRecord(profileId, questionId, correct){
		console.log('Inserting answer record for profile:', profileId);
		const {error} = await supabase.from('answers').insert({profile_id:profileId, question_id:questionId, correct});
		if(error) console.error('Error inserting answer:', error);
	}


	// If Supabase is enabled, use Supabase Auth to sign-in or sign-up users.
	async function loginWithSupabase(username, password){
	  if(!supabase) return null;
	  try{
	    // Look up profile by username in the `profiles` table.
	    const { data, error } = await supabase.from('profiles').select('*').eq('username', username).limit(1).maybeSingle();
	    if(error){ console.error('Error fetching profile during login:', error); alert('Erro: ' + (error.message || 'problema ao verificar usuário')); return null; }

	    // If profile exists, validate password
	    if(data){
	      if((data.password || '') === password){
	        return { username, user: data };
	      } else {
	        alert('Senha incorreta');
	        return null;
	      }
	    }

	    // If not found, create a new profile with provided username/password
	    const { data: created, error: insertErr } = await supabase.from('profiles').insert({ username, password, points: 0 }).select().maybeSingle();
	    if(insertErr){ console.error('Error creating profile during signup:', insertErr); alert('Erro: ' + (insertErr.message || 'não foi possível criar usuário')); return null; }
	    return { username, user: created };
	  }catch(e){ console.error('loginWithSupabase exception', e); alert('Erro inesperado: ' + (e.message||e)); return null; }
	}

	// --- UI helpers (use cached questionsCache) ---
	async function renderAuth(){
		const current = localStorage.getItem(STORAGE_KEYS.CURRENT);
		if(current){
			const p = await getProfileByUsername(current) || {};
			$('login-panel').classList.add('hidden'); $('profile').classList.remove('hidden'); $('welcome').textContent=`Olá, ${current} — ${p.points||0} pts`;
		} else { $('login-panel').classList.remove('hidden'); $('profile').classList.add('hidden') }
	}

	function getQuestionOfDay(){
		if(!questionsCache || questionsCache.length===0) return null;
		const days = Math.floor(Date.now() / (1000*60*60*24));
		const idx = days % questionsCache.length;
		return questionsCache[idx];
	}

	async function renderQuestion(){
		const current = localStorage.getItem(STORAGE_KEYS.CURRENT);
		if(!current){ $('question-area').classList.add('hidden'); $('q-result').classList.add('hidden'); return }
		const q = getQuestionOfDay();
		if(!q){ $('question-area').classList.add('hidden'); return }
		$('question-area').classList.remove('hidden');
		$('q-text').textContent = q.text;
		const opts = $('q-options'); opts.innerHTML='';

		['a','b','c','d'].forEach(k=>{
			const btn = document.createElement('div'); btn.className='opt'; btn.tabIndex=0;
			btn.textContent = `${k.toUpperCase()}: ${q[k] || q['option_'+k] || ''}`;
			const opt = k.toUpperCase(); btn.dataset.opt = opt;
			btn.addEventListener('click', ()=> handleAnswer(q, opt, btn));
			opts.appendChild(btn);
		});

		// Disable if already answered today
		const p = await getProfileByUsername(localStorage.getItem(STORAGE_KEYS.CURRENT));
		if(p && (p.last_answer_date===todayISO() || p.lastAnswered===todayISO())){
			Array.from(opts.children).forEach(ch=>ch.style.pointerEvents='none');
			showResult(false,'Já respondeste hoje. Volta amanhã.');
			return;
		}
	}

	async function renderLeaderboard(){
			const list = await getProfilesForLeaderboard();
			const ol = $('leader-list'); ol.innerHTML='';
			const maxShow = leaderShowAll ? list.length : Math.min(20, list.length);
			for(let i=0;i<maxShow;i++){
				const p = list[i];
				const li = document.createElement('li'); li.className='leader-item';
				const rank = document.createElement('span'); rank.className='leader-rank'; rank.textContent = `${i+1}. `;
				const rawName = (p.username || p.name || '').toString();
				const displayName = rawName.replace(/^\d+\.\s*/, '');
				const name = document.createElement('span'); name.className='leader-name'; name.textContent = displayName;
				const spacer = document.createElement('span'); spacer.className='leader-spacer'; spacer.textContent = ' — ';
				const points = document.createElement('span'); points.className='leader-points'; points.textContent = `${p.points || 0} pts`;
				li.appendChild(rank);
				li.appendChild(name);
				li.appendChild(spacer);
				li.appendChild(points);
				ol.appendChild(li);
			}
			// toggle button
			const toggle = $('btn-leader-toggle'); if(toggle){ toggle.textContent = leaderShowAll ? 'Mostrar apenas top 20' : `Mostrar todos (${list.length})`; }
		}

	function showResult(ok, text){ const el = $('q-result'); el.className=''; el.classList.add(ok? 'correct':'wrong'); el.classList.remove('hidden'); el.textContent = text; }

	// --- Auth / Answer flow ---
	// Login only - does NOT create new accounts, only logs into existing ones
	async function loginProfile(username, password){
		console.log('Attempting login for:', username);
		if(!supabase) return null;
		try{
			// Look up profile by username
			const { data, error } = await supabase.from('profiles').select('*').eq('username', username).limit(1).maybeSingle();
			if(error){ console.error('Error fetching profile during login:', error); alert('Erro: ' + (error.message || 'problema ao verificar usuário')); return null; }
			
			// Profile must exist
			if(!data){
				alert('Usuário não encontrado. Registre-se primeiro.');
				return null;
			}
			
			// Validate password
			if((data.password || '') === password){
				console.log('Login successful for:', username);
				return { username, user: data };
			} else {
				alert('Senha incorreta');
				return null;
			}
		}catch(e){ console.error('loginProfile exception', e); alert('Erro inesperado: ' + (e.message||e)); return null; }
	}

	async function registerProfile(username, password){
		console.log('Attempting registration for:', username);
		const result = await loginWithSupabase(username, password);
		if(!result){
			return null;
		}
		console.log('Registration successful for:', username);
		return result;
	}

	async function handleAnswer(q, opt, el){
		const current = localStorage.getItem(STORAGE_KEYS.CURRENT);
		if(!current){ alert('Faça login primeiro'); return }
		const profile = await getProfileByUsername(current);
		if(!profile) return;
		const today = todayISO();

		// Already answered check
		const answeredToday = profile.last_answer_date === today || profile.lastAnswered === today;
		if(answeredToday){ Array.from($('q-options').children).forEach(ch=>ch.style.pointerEvents='none'); showResult(false,'Você já respondeu hoje. Volte amanhã.'); return }

		// disable UI
		Array.from($('q-options').children).forEach(ch=>{ ch.style.pointerEvents='none'; ch.classList.remove('correct-opt','wrong-opt'); });

		const correct = opt === q.correct;
		// update DB
		if(correct){
			const newPoints = (profile.points || 0) + 1;
			await updateProfilePoints(profile.username || profile.name, newPoints, today);
		} else {
			await updateProfilePoints(profile.username || profile.name, profile.points || 0, today);
		}

		// insert answer record if we have profile id
		if(profile.id){ await insertAnswerRecord(profile.id, q.id || null, correct); }

		// highlight
		if(correct) el.classList.add('correct-opt'); else el.classList.add('wrong-opt');
		Array.from($('q-options').children).forEach(ch=>{ if(ch.dataset.opt===q.correct) ch.classList.add('correct-opt'); });

		showResult(correct, correct? 'Correto! +1 ponto. Volta amanhã!' : 'Incorreto. +0 ponto');
		// refresh welcome/leaderboard
		await renderAuth(); await renderLeaderboard();
	}

	// Admin simple functions unchanged (local add still works)
	function adminLogin(token){ if(token===ADMIN_TOKEN){ $('admin-panel').classList.remove('hidden'); $('admin-login').classList.add('hidden'); } else alert('Token inválido') }
	function addQuestionFromAdmin(){
		const text = $('new-q-text').value.trim(); const a=$('opt-a').value.trim(); const b=$('opt-b').value.trim(); const c=$('opt-c').value.trim(); const d=$('opt-d').value.trim(); const correct=$('correct').value;
		if(!text||!a||!b||!c||!d){ alert('Preencha todos os campos'); return }
		if(supabase){
			console.log('Adding question via admin');
			supabase.from('questions').insert({question_text:text, option_a:a, option_b:b, option_c:c, option_d:d, correct}).then(()=>{ alert('Pergunta adicionada (DB)'); console.log('Question added'); });
		} else {
			const qs = loadLocal(STORAGE_KEYS.QUESTIONS, []);
			const id = qs.length? (Math.max(...qs.map(x=>x.id))+1):1; qs.push({id,text,a,b,c,d,correct}); saveLocal(STORAGE_KEYS.QUESTIONS,qs); alert('Pergunta adicionada (local)');
		}
		$('new-q-text').value=''; $('opt-a').value=''; $('opt-b').value=''; $('opt-c').value=''; $('opt-d').value='';
		renderQuestion();
	}

	// Events
	function attach(){
		$('btn-login').addEventListener('click', async ()=>{
			const name = $('username').value.trim(); const pwd = $('password').value; if(!name||!pwd){alert('Digite nome e senha');return}
			$('btn-login').querySelector('.original').textContent = 'Entrando...';
			const profile = await loginProfile(name,pwd);
			$('btn-login').querySelector('.original').textContent = 'Entrar';
			if(!profile) return;
			localStorage.setItem(STORAGE_KEYS.CURRENT, name);
			await renderAuth(); await renderQuestion(); await renderLeaderboard();
		});
		$('btn-register').addEventListener('click', async ()=>{
			const name = $('username').value.trim(); const pwd = $('password').value; if(!name||!pwd){alert('Digite nome e senha');return}
			$('btn-register').querySelector('.original').textContent = 'Registrando...';
			const profile = await registerProfile(name,pwd);
			$('btn-register').querySelector('.original').textContent = 'Registrar';
			if(!profile) return;
			localStorage.setItem(STORAGE_KEYS.CURRENT, name);
			await renderAuth(); await renderQuestion(); await renderLeaderboard();
		});
		$('btn-logout').addEventListener('click', async ()=>{ 
			if(supabase) await supabase.auth.signOut();
			localStorage.removeItem(STORAGE_KEYS.CURRENT); 
			renderAuth(); 
			renderQuestion(); 
			$('q-result').classList.add('hidden'); 
		});
		$('btn-admin-login').addEventListener('click', ()=>{ adminLogin($('admin-token').value.trim()) });
		$('btn-add-q').addEventListener('click', addQuestionFromAdmin);

		const toggle = $('btn-leader-toggle');
		if(toggle){ toggle.addEventListener('click', ()=>{ leaderShowAll = !leaderShowAll; renderLeaderboard(); }); }
	}

	// Bootstrap
	async function init(){
		console.log('Initializing app');
		if(!supabase){ console.error('Supabase not available'); alert('Erro: Supabase não disponível'); return; }
		await ensureSeedQuestions();
		questionsCache = await fetchQuestions();
		attach(); await renderAuth(); await renderQuestion(); await renderLeaderboard();
		console.log('App initialized');
	}
	window.addEventListener('DOMContentLoaded', init);

})();
