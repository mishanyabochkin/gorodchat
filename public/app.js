let supabaseClient = null;
let myName = localStorage.getItem("gc_name") || "";
let channel = null;
let joined = false;

const $ = s => document.querySelector(s);

function configured() {
  return SUPABASE_URL && SUPABASE_ANON_KEY;
}

function setStatus(text) {
  $("#status").textContent = text;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function addMessage(m) {
  const el = document.createElement("div");
  el.className = "msg" + (m.name === myName ? " mine" : "");
  const date = new Date(m.created_at || Date.now());
  const time = date.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  el.innerHTML = `<div class="meta">${escapeHtml(m.name)} <span class="time">${time}</span></div>
                  <div>${escapeHtml(m.text).replace(/\n/g,"<br>")}</div>`;
  $("#messages").appendChild(el);
  $("#messages").scrollTop = $("#messages").scrollHeight;
}

function addSystem(text) {
  const el = document.createElement("div");
  el.className = "system";
  el.textContent = text;
  $("#messages").appendChild(el);
}

async function loadHistory() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("id,name,text,created_at")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    addSystem("Не удалось загрузить сообщения.");
    console.error(error);
    return;
  }
  data.forEach(addMessage);
}

function subscribe() {
  channel = supabaseClient
    .channel("city-chat-room")
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      payload => addMessage(payload.new)
    )
    .subscribe(status => {
      if (status === "SUBSCRIBED") {
        $("#online").textContent = "●";
        addSystem("Подключено к чату.");
      }
    });
}

async function join() {
  if (!configured()) {
    setStatus("Сначала нужно заполнить config.js данными Supabase.");
    return;
  }

  myName = ($("#name").value.trim() ||
    "Гость_" + Math.floor(Math.random() * 900 + 100)).slice(0, 24);
  localStorage.setItem("gc_name", myName);

  $("#join").disabled = true;
  setStatus("Подключаемся…");

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    await loadHistory();
    subscribe();
    joined = true;
    $("#setup").classList.add("hidden");
    $("#app").classList.remove("hidden");
    $("#text").focus();
  } catch (e) {
    console.error(e);
    setStatus("Ошибка подключения.");
    $("#join").disabled = false;
  }
}

$("#join").onclick = join;

$("#form").onsubmit = async e => {
  e.preventDefault();
  const text = $("#text").value.trim();
  if (!text || !joined) return;

  const { error } = await supabaseClient.from("messages").insert({
    name: myName,
    text
  });

  if (error) {
    addSystem("Сообщение не отправлено.");
    console.error(error);
    return;
  }
  $("#text").value = "";
};

$("#menu").onclick = () => $("#menuPanel").classList.remove("hidden");
$("#closeMenu").onclick = () => $("#menuPanel").classList.add("hidden");

$("#changeName").onclick = () => {
  const n = prompt("Новый ник:", myName);
  if (!n || !n.trim()) return;
  myName = n.trim().slice(0,24);
  localStorage.setItem("gc_name", myName);
  addSystem("Теперь твой ник: " + myName);
  $("#menuPanel").classList.add("hidden");
};

$("#myname").onclick = () => alert("Твой ник: " + myName);
$("#clear").onclick = () => $("#messages").replaceChildren();
$("#smile").onclick = () => {
  $("#text").value += " 🙂";
  $("#text").focus();
};
$("#about").onclick = () => alert(
  "ГородЧат — первый интернет-прототип.\n\n" +
  "Анонимный ник, общий чат и сообщения в реальном времени.\n" +
  "Пока это тестовая версия."
);

if (myName) $("#name").value = myName;
