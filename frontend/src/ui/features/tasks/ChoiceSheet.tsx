import { useId, type ReactNode } from "react";
import { t } from "../../copy";
import { CheckIcon } from "../../components/icons";
import { Sheet } from "../../components/Sheet";

export interface Choice<V extends string> {
  value: V;
  label: string;
  /** e.g. a project colour dot. Decorative. */
  marker?: ReactNode;
}

export interface ChoiceSheetProps<V extends string> {
  open: boolean;
  title: string;
  choices: ReadonlyArray<Choice<V>>;
  value: V;
  onChoose: (value: V) => void;
  onClose: () => void;
}

/** A sheet of radio options; picking one saves at once and closes (TK §2.2, no Save button). */
export function ChoiceSheet<V extends string>({
  open,
  title,
  choices,
  value,
  onChoose,
  onClose,
}: ChoiceSheetProps<V>) {
  const name = useId();
  return (
    <Sheet
      open={open}
      title={title}
      closeLabel={t("common.close")}
      onClose={onClose}
    >
      <fieldset className="m-0 border-0 p-0">
        <legend className="sr-only">{title}</legend>
        {choices.map((choice) => (
          <label
            key={choice.value}
            className="group/choice relative flex min-h-11 cursor-pointer items-center gap-3 border-b border-separator has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary [&>input]:absolute [&>input]:inset-0 [&>input]:m-0 [&>input]:cursor-pointer [&>input]:opacity-0"
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={choice.value === value}
              onChange={() => {
                onChoose(choice.value);
                onClose();
              }}
            />
            {choice.marker && <span aria-hidden="true">{choice.marker}</span>}
            <span className="flex-1 group-has-checked/choice:font-medium group-has-checked/choice:text-primary">
              {choice.label}
            </span>
            {choice.value === value && (
              <CheckIcon size={18} className="text-primary" />
            )}
          </label>
        ))}
      </fieldset>
    </Sheet>
  );
}
