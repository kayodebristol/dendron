import { ReactNode } from "react";
import { Alert } from "antd";
import { useToggle } from "../hooks/useToggle";
import { DENDRON_STYLE_CONSTANTS } from "../styles/constants";

const { LAYOUT } = DENDRON_STYLE_CONSTANTS;

export const DendronNotice = ({
  show = false,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) => {
  const [val, toggle] = useToggle(show);
  return (
    <>
      {val && (
        <Alert
          style={{ textAlign: "center" }}
          type="info"
          banner
          message={children}
          closable
          afterClose={() => toggle(false)}
        />
      )}
    </>
  );
};

export default DendronNotice;
