import { SetStateAction } from "react";
import styles from "../styles/Home.module.css";

interface InputParams {
  divStyles?: string;
  inputStyles?: string;
  placeholder?: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: SetStateAction<string>) => void;
}

export const Input = (params: InputParams) => {
  return (
    <div className={params.divStyles || styles.vesteeInputContainer}>
      <label htmlFor={params.name}>{params.label}</label>
      <input
        className={params.inputStyles || styles.vesteeInput}
        name={params.name}
        placeholder={params.placeholder}
        value={params.value}
        onChange={(e) => params.onChange(e.target.value)}
      />
    </div>
  );
};
