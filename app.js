const form = document.querySelector("#task-form");
const input = document.querySelector("#task-input");
const timeInput = document.querySelector("#task-time");
const dateInput = document.querySelector("#task-date");
const taskList = document.querySelector("#task-list");
const emptyMessage = document.querySelector("#empty-message");
const calendarDays = document.querySelector("#calendar-days");
const monthYear = document.querySelector("#month-year");
const previousMonthButton = document.querySelector("#prev");
const nextMonthButton = document.querySelector("#next");
const backgroundInput = document.querySelector("#background-input");
const chooseBackgroundButton = document.querySelector("#choose-background");
const backgroundStatus = document.querySelector("#background-status");
const removeBackgroundButton = document.querySelector("#remove-background");
const reminderMessage = document.querySelector("#reminder-message");

let tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
const today = new Date();
let selectedDate = formatDate(today);
let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let activeReminderMessage = "";
let activeReminderUntil = 0;
const backgroundStorageKey = "tasklist-background";
const maxBackgroundInputSize = 15 * 1024 * 1024;
const maxStoredBackgroundSize = 1.5 * 1024 * 1024;
dateInput.value = selectedDate;

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

function getTaskTimestamp(task) {
  if (!task.date || !task.time) return null;

  const [year, month, day] = task.date.split("-").map(Number);
  const [hours, minutes] = task.time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes).getTime();
}

function updateRobotMessage() {
  if (activeReminderUntil > Date.now()) {
    reminderMessage.textContent = activeReminderMessage;
    return;
  }

  const nextTask = tasks
    .filter((task) => !task.completed)
    .map((task) => ({ task, timestamp: getTaskTimestamp(task) }))
    .filter(({ timestamp }) => timestamp !== null && timestamp >= Date.now())
    .sort((first, second) => first.timestamp - second.timestamp)[0];

  reminderMessage.textContent = nextTask
    ? `Próxima: ${nextTask.task.text}, ${formatDisplayDate(nextTask.task.date)} a las ${nextTask.task.time}.`
    : "Agrega una tarea y te recordaré su horario.";
}

function checkReminders() {
  const now = Date.now();
  const reminders = [];

  tasks.forEach((task) => {
    const timestamp = getTaskTimestamp(task);
    if (
      !task.completed &&
      !task.reminded &&
      timestamp !== null &&
      timestamp <= now &&
      now - timestamp < 60_000
    ) {
      task.reminded = true;
      reminders.push(task);
    }
  });

  if (reminders.length > 0) {
    saveTasks();
    activeReminderMessage = reminders.length === 1
      ? `¡Es hora de ${reminders[0].text}!`
      : `¡Tienes ${reminders.length} tareas programadas ahora!`;
    activeReminderUntil = now + 60_000;
    reminderMessage.textContent = activeReminderMessage;
  } else {
    updateRobotMessage();
  }
}

function applyBackground(imageData) {
  document.body.style.setProperty("--custom-background", `url("${imageData}")`);
  document.body.classList.add("has-background");
  removeBackgroundButton.hidden = false;
}

function saveBackground(imageData) {
  try {
    localStorage.setItem(backgroundStorageKey, imageData);
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      backgroundStatus.textContent = "No hay espacio suficiente para guardar esa imagen.";
      backgroundInput.value = "";
      return;
    }
    throw error;
  }

  applyBackground(imageData);
  backgroundStatus.textContent = "Fondo guardado.";
  backgroundInput.value = "";
}

function optimizeBackground(imageData) {
  const image = new Image();

  image.addEventListener("load", () => {
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      backgroundStatus.textContent = "No se pudo optimizar la imagen.";
      backgroundInput.value = "";
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        backgroundStatus.textContent = "No se pudo optimizar la imagen.";
        backgroundInput.value = "";
        return;
      }

      if (blob.size > maxStoredBackgroundSize) {
        backgroundStatus.textContent = "No se pudo reducir la imagen lo suficiente.";
        backgroundInput.value = "";
        return;
      }

      const optimizedReader = new FileReader();
      optimizedReader.addEventListener("load", () => {
        if (typeof optimizedReader.result !== "string") {
          backgroundStatus.textContent = "No se pudo leer la imagen optimizada.";
          backgroundInput.value = "";
          return;
        }
        saveBackground(optimizedReader.result);
      });
      optimizedReader.addEventListener("error", () => {
        backgroundStatus.textContent = "No se pudo leer la imagen optimizada.";
        backgroundInput.value = "";
      });
      optimizedReader.readAsDataURL(blob);
    }, "image/jpeg", 0.82);
  });

  image.addEventListener("error", () => {
    backgroundStatus.textContent = "No se pudo abrir esa imagen.";
    backgroundInput.value = "";
  });
  image.src = imageData;
}

function renderCalendar() {
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;

  monthYear.textContent = new Intl.DateTimeFormat("es", {
    month: "long",
    year: "numeric"
  }).format(displayedMonth);
  calendarDays.replaceChildren();

  for (let i = 0; i < firstDayOffset; i += 1) {
    const emptyDay = document.createElement("li");
    emptyDay.className = "calendar-empty";
    emptyDay.setAttribute("aria-hidden", "true");
    calendarDays.append(emptyDay);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = formatDate(new Date(year, month, day));
    const taskCount = tasks.filter((task) => task.date === date).length;
    const listItem = document.createElement("li");
    const dayButton = document.createElement("button");

    dayButton.type = "button";
    dayButton.className = "calendar-day";
    dayButton.textContent = String(day);
    dayButton.setAttribute("aria-pressed", String(date === selectedDate));
    dayButton.setAttribute(
      "aria-label",
      taskCount
        ? `${formatDisplayDate(date)}, ${taskCount} ${taskCount === 1 ? "tarea" : "tareas"}`
        : formatDisplayDate(date)
    );

    if (date === selectedDate) dayButton.classList.add("is-selected");
    if (date === formatDate(today)) dayButton.classList.add("is-today");
    if (taskCount > 0) dayButton.classList.add("has-tasks");

    dayButton.addEventListener("click", () => {
      selectedDate = date;
      dateInput.value = date;
      renderCalendar();
    });

    listItem.append(dayButton);
    calendarDays.append(listItem);
  }
}

function renderTasks() {
  taskList.replaceChildren();
  emptyMessage.hidden = tasks.length > 0;

  tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = task.completed ? "task completed" : "task";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Completar: ${task.text}`);

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;

    const details = document.createElement("div");
    details.className = "task-details";

    if (task.date) {
      const date = document.createElement("time");
      date.className = "task-date";
      date.dateTime = task.date;
      date.textContent = formatDisplayDate(task.date);
      details.append(date);
    }

    if (task.time) {
      const time = document.createElement("time");
      time.className = "task-time";
      time.dateTime = task.time;
      time.textContent = task.time;
      details.append(time);
    }

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Eliminar";

    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      saveTasks();
      renderTasks();
    });

    deleteButton.addEventListener("click", () => {
      tasks = tasks.filter((currentTask) => currentTask.id !== task.id);
      saveTasks();
      renderTasks();
      renderCalendar();
    });

    item.append(checkbox, text, details, deleteButton);
    taskList.append(item);
  });

  updateRobotMessage();
}

backgroundInput.addEventListener("change", () => {
  const [file] = backgroundInput.files;
  if (!file) return;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    backgroundStatus.textContent = "Elige una imagen JPG, PNG, WEBP o GIF.";
    backgroundInput.value = "";
    return;
  }

  if (file.size > maxBackgroundInputSize) {
    backgroundStatus.textContent = "La imagen debe pesar 15 MB o menos.";
    backgroundInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    if (typeof reader.result !== "string") {
      backgroundStatus.textContent = "No se pudo leer la imagen.";
      backgroundInput.value = "";
      return;
    }

    if (file.size > maxStoredBackgroundSize) {
      backgroundStatus.textContent = "Optimizando imagen...";
      optimizeBackground(reader.result);
      return;
    }

    saveBackground(reader.result);
  });
  reader.addEventListener("error", () => {
    backgroundStatus.textContent = "No se pudo leer la imagen.";
    backgroundInput.value = "";
  });
  reader.readAsDataURL(file);
});

chooseBackgroundButton.addEventListener("click", () => {
  backgroundInput.click();
});

removeBackgroundButton.addEventListener("click", () => {
  localStorage.removeItem(backgroundStorageKey);
  document.body.classList.remove("has-background");
  document.body.style.removeProperty("--custom-background");
  removeBackgroundButton.hidden = true;
  backgroundInput.value = "";
  backgroundStatus.textContent = "Fondo eliminado.";
});

previousMonthButton.addEventListener("click", () => {
  displayedMonth = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth() - 1,
    1
  );
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  displayedMonth = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth() + 1,
    1
  );
  renderCalendar();
});

dateInput.addEventListener("change", () => {
  if (!dateInput.value) return;

  selectedDate = dateInput.value;
  const [year, month] = selectedDate.split("-").map(Number);
  displayedMonth = new Date(year, month - 1, 1);
  renderCalendar();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  tasks.push({
    id: crypto.randomUUID(),
    text,
    time: timeInput.value,
    date: dateInput.value,
    completed: false
  });

  saveTasks();
  renderTasks();
  renderCalendar();
  form.reset();
  dateInput.value = selectedDate;
  input.focus();
});

const savedBackground = localStorage.getItem(backgroundStorageKey);
if (savedBackground) applyBackground(savedBackground);

renderTasks();
renderCalendar();
checkReminders();
window.setInterval(checkReminders, 15_000);