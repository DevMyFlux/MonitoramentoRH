import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Plus, RefreshCw, Save } from "lucide-react";
import { Badge, Button, Input, Select } from "../components/ui";

type Position = {
  id: string;
  label: string;
  team: string;
  shift: string;
};

type Employee = {
  id: string;
  name: string;
  aptitude: "GREEN" | "YELLOW" | "RED";
  available: boolean;
};

type Assignment = {
  positionId: string;
  employeeId: string;
  justification?: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  day: number;
};

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export function SchedulePage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [adjustment, setAdjustment] = useState({
    positionId: "",
    employeeId: "",
    justification: ""
  });
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => buildMonthDays(month), [month]);
  const uncoveredPositions = positions.filter(
    (position) => !assignments.some((assignment) => assignment.positionId === position.id)
  );
  const conflicts = assignments.flatMap((assignment) => {
    const employee = employees.find((item) => item.id === assignment.employeeId);
    if (!employee || (employee.aptitude === "GREEN" && employee.available)) {
      return [];
    }

    return [
      {
        assignment,
        employee,
        code: employee.available ? "APTITUDE_NOT_GREEN" : "EMPLOYEE_UNAVAILABLE"
      }
    ];
  });
  const incompleteTeams = positions
    .map((position) => position.team)
    .filter((team, index, source) => team && source.indexOf(team) === index)
    .filter((team) =>
      positions
        .filter((position) => position.team === team)
        .some(
          (position) => !assignments.some((assignment) => assignment.positionId === position.id)
        )
    );

  function addPosition() {
    const next = positions.length + 1;
    setPositions([
      ...positions,
      { id: `position-${next}`, label: `Posicao ${next}`, shift: "Diurno", team: "Equipe A" }
    ]);
  }

  function addEmployee() {
    const next = employees.length + 1;
    setEmployees([
      ...employees,
      { id: `employee-${next}`, name: `Colaborador ${next}`, aptitude: "GREEN", available: true }
    ]);
  }

  function addEvent() {
    const next = events.length + 1;
    setEvents([...events, { id: `event-${next}`, title: `Evento ${next}`, day: 1 }]);
  }

  function applyAdjustment() {
    setError(null);
    const employee = employees.find((item) => item.id === adjustment.employeeId);
    if (!adjustment.positionId || !employee) {
      setError("Selecione uma posicao e um colaborador.");
      return;
    }
    const breaksRule = employee.aptitude !== "GREEN" || !employee.available;
    if (breaksRule && adjustment.justification.trim().length < 5) {
      setError("Quebra de regra exige justificativa.");
      return;
    }

    const nextAssignment: Assignment = {
      positionId: adjustment.positionId,
      employeeId: employee.id
    };
    if (breaksRule) {
      nextAssignment.justification = adjustment.justification.trim();
    }

    setAssignments([
      ...assignments.filter((item) => item.positionId !== adjustment.positionId),
      nextAssignment
    ]);
    setAdjustment({ positionId: "", employeeId: "", justification: "" });
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="info">ETAPA 11</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">Escalas</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {monthFormatter.format(new Date(`${month}-01T00:00:00`))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-44"
            label="Mes"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
          <Button icon={<RefreshCw size={16} />} variant="secondary">
            Atualizar
          </Button>
        </div>
      </section>

      <section className="grid gap-3 rounded border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-7">
        {days.map((day) => (
          <div key={day.day} className="min-h-28 rounded border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-950">{day.day}</span>
              {day.isToday ? <Badge tone="success">Hoje</Badge> : null}
            </div>
            <div className="mt-3 space-y-2">
              {events
                .filter((event) => event.day === day.day)
                .map((event) => (
                  <div
                    key={event.id}
                    className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-800"
                  >
                    {event.title}
                  </div>
                ))}
              {assignments.slice(0, 2).map((assignment) => (
                <div
                  key={`${day.day}-${assignment.positionId}`}
                  className="rounded bg-slate-100 px-2 py-1 text-xs"
                >
                  {labelFor(positions, assignment.positionId)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <Panel
          title="Alocacoes"
          action={
            <Button icon={<Plus size={16} />} onClick={addPosition}>
              Posicao
            </Button>
          }
        >
          <div className="space-y-2">
            {positions.map((position) => (
              <div key={position.id} className="rounded border border-slate-200 p-3 text-sm">
                <div className="font-medium text-slate-950">{position.label}</div>
                <div className="text-slate-500">
                  {position.shift} · {position.team}
                </div>
              </div>
            ))}
            {positions.length === 0 ? <EmptyLine text="Nenhuma posicao adicionada." /> : null}
          </div>
        </Panel>

        <Panel
          title="Colaboradores"
          action={
            <Button icon={<Plus size={16} />} onClick={addEmployee}>
              Colaborador
            </Button>
          }
        >
          <div className="space-y-2">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between rounded border border-slate-200 p-3 text-sm"
              >
                <span className="font-medium text-slate-950">{employee.name}</span>
                <Badge
                  tone={employee.aptitude === "GREEN" && employee.available ? "success" : "danger"}
                >
                  {employee.aptitude}
                </Badge>
              </div>
            ))}
            {employees.length === 0 ? <EmptyLine text="Nenhum colaborador adicionado." /> : null}
          </div>
        </Panel>

        <Panel
          title="Eventos"
          action={
            <Button icon={<CalendarDays size={16} />} onClick={addEvent}>
              Evento
            </Button>
          }
        >
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="rounded border border-slate-200 p-3 text-sm">
                <div className="font-medium text-slate-950">{event.title}</div>
                <div className="text-slate-500">Dia {event.day}</div>
              </div>
            ))}
            {events.length === 0 ? <EmptyLine text="Nenhum evento no mes." /> : null}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Ajustes">
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Posicao"
              options={[
                { label: "Selecione", value: "" },
                ...positions.map((item) => ({ label: item.label, value: item.id }))
              ]}
              value={adjustment.positionId}
              onChange={(event) => setAdjustment({ ...adjustment, positionId: event.target.value })}
            />
            <Select
              label="Colaborador"
              options={[
                { label: "Selecione", value: "" },
                ...employees.map((item) => ({ label: item.name, value: item.id }))
              ]}
              value={adjustment.employeeId}
              onChange={(event) => setAdjustment({ ...adjustment, employeeId: event.target.value })}
            />
            <Input
              className="md:col-span-2"
              label="Justificativa"
              value={adjustment.justification}
              onChange={(event) =>
                setAdjustment({ ...adjustment, justification: event.target.value })
              }
            />
          </div>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          <Button className="mt-4" icon={<Save size={16} />} onClick={applyAdjustment}>
            Aplicar ajuste
          </Button>
        </Panel>

        <Panel title="Conflitos e vagas">
          <SummaryLine label="Vagas" value={uncoveredPositions.length} tone="warning" />
          <SummaryLine label="Conflitos" value={conflicts.length} tone="danger" />
          <SummaryLine label="Equipes incompletas" value={incompleteTeams.length} tone="warning" />
          <div className="mt-4 space-y-2">
            {conflicts.map((conflict) => (
              <div
                key={`${conflict.assignment.positionId}-${conflict.code}`}
                className="flex gap-2 rounded bg-red-50 p-2 text-sm text-red-800"
              >
                <AlertTriangle aria-hidden="true" size={16} />
                <span>{conflict.code}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({
  action,
  children,
  title
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SummaryLine({
  label,
  tone,
  value
}: {
  label: string;
  tone: "danger" | "warning";
  value: number;
}) {
  return (
    <div className="mb-2 flex items-center justify-between rounded border border-slate-200 p-3 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="rounded border border-dashed border-slate-300 p-3 text-sm text-slate-500">
      {text}
    </p>
  );
}

function buildMonthDays(month: string) {
  const [parsedYear, parsedMonth] = month.split("-").map(Number);
  const now = new Date();
  const year = parsedYear ?? now.getFullYear();
  const monthNumber = parsedMonth ?? now.getMonth() + 1;
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const today = new Date();

  return Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    return {
      day,
      isToday:
        today.getFullYear() === year &&
        today.getMonth() + 1 === monthNumber &&
        today.getDate() === day
    };
  });
}

function labelFor(positions: Position[], positionId: string) {
  return positions.find((position) => position.id === positionId)?.label ?? positionId;
}
